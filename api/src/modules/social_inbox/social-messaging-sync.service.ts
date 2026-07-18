import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import {
  SocialMessages,
  InboxAttachment,
  InboxReaction,
} from './entities/social_messages.entity';
import { SocialDmAutoReplyService } from './social-dm-auto-reply.service';
import { scopeWhere } from '../../common/workspace-scope.util';

@Injectable()
export class SocialMessagingSyncService {
  private readonly logger = new Logger(SocialMessagingSyncService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly accountsRepo: Repository<SocialAccounts>,
    @InjectRepository(SocialMessages)
    private readonly messagesRepo: Repository<SocialMessages>,
    private readonly autoReply: SocialDmAutoReplyService,
  ) {}

  async syncForTenant(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<{ synced: number }> {
    const accounts = await this.accountsRepo.find({
      where: scopeWhere<SocialAccounts>(tenantId, workspaceId),
    });
    const connected = accounts.filter((a) => a.connected);
    let synced = 0;
    for (const account of connected) {
      if (!['facebook', 'instagram', 'twitter', 'x'].includes(account.platform)) {
        continue;
      }
      try {
        synced +=
          account.platform === 'twitter' || account.platform === 'x'
            ? await this.syncTwitterAccount(account, userId)
            : await this.syncAccount(account, userId);
      } catch (err) {
        this.logger.warn(`DM sync failed for ${account.platform}`, err);
      }
    }
    return { synced };
  }

  private async syncTwitterAccount(
    account: SocialAccounts,
    userId: string,
  ): Promise<number> {
    const token = account.accessToken?.trim();
    if (!token) return 0;

    const platform = account.platform === 'x' ? 'x' : 'twitter';
    const res = await axios.get('https://api.twitter.com/2/dm_events', {
      params: {
        max_results: 50,
        'dm_event.fields': 'id,text,sender_id,dm_conversation_id,created_at',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    let synced = 0;
    const events = res.data?.data ?? [];
    for (const evt of events) {
      const externalId = String(evt.id ?? '');
      if (!externalId) continue;

      const exists = await this.messagesRepo.findOne({
        where: {
          tenantId: account.tenantId,
          platform,
          externalMessageId: externalId,
        },
      });
      if (exists) continue;

      const senderId = String(evt.sender_id ?? '');
      const isOutbound = senderId === account.externalId;
      const threadId = String(evt.dm_conversation_id ?? senderId);
      const body = String(evt.text ?? '');

      const saved = await this.messagesRepo.save(
        this.messagesRepo.create({
          tenantId: account.tenantId,
          workspaceId: account.workspaceId,
          platform,
          threadId,
          externalMessageId: externalId,
          participantId: isOutbound ? threadId : senderId,
          direction: isOutbound ? 'outbound' : 'inbound',
          body,
          attachments: [],
          reactions: [],
          status: isOutbound ? 'sent' : 'received',
        }),
      );
      synced++;

      if (!isOutbound && body.trim()) {
        await this.autoReply.tryReply({
          tenantId: account.tenantId,
          platform,
          threadId,
          participantId: saved.participantId,
          inboundText: body,
          account,
          userId,
        });
      }
    }

    return synced;
  }

  private async syncAccount(
    account: SocialAccounts,
    userId: string,
  ): Promise<number> {
    const token = account.metadata?.page_token ?? account.accessToken;
    const pageId = account.metadata?.page_id ?? account.externalId;
    if (!token || !pageId) return 0;

    const res = await axios.get(
      `https://graph.facebook.com/v19.0/${pageId}/conversations`,
      {
        params: {
          access_token: token,
          fields:
            'id,participants,updated_time,messages.limit(25){id,message,from,created_time,attachments,reactions}',
          limit: 25,
        },
      },
    );

    let synced = 0;
    for (const conv of res.data?.data ?? []) {
      const threadId = String(conv.id);
      const participants =
        (conv.participants as { data?: Array<{ id?: string; name?: string }> })
          ?.data ?? [];
      const customer =
        participants.find((p) => p.id !== pageId) ?? participants[0];

      for (const msg of (conv.messages as { data?: Record<string, unknown>[] })
        ?.data ?? []) {
        const externalId = String(msg.id ?? '');
        if (!externalId) continue;

        const exists = await this.messagesRepo.findOne({
          where: {
            tenantId: account.tenantId,
            platform: account.platform,
            externalMessageId: externalId,
          },
        });
        if (exists) continue;

        const from = msg.from as { id?: string; name?: string } | undefined;
        const isOutbound = from?.id === pageId;
        const attachments = this.parseAttachments(msg.attachments);
        const reactions = this.parseReactions(msg.reactions);
        const body =
          String(msg.message ?? '') || this.attachmentPreview(attachments);

        const saved = await this.messagesRepo.save(
          this.messagesRepo.create({
            tenantId: account.tenantId,
            workspaceId: account.workspaceId,
            platform: account.platform,
            threadId,
            externalMessageId: externalId,
            participantId: String(customer?.id ?? from?.id ?? 'unknown'),
            participantName: customer?.name ?? from?.name,
            direction: isOutbound ? 'outbound' : 'inbound',
            body,
            attachments,
            reactions,
            status: isOutbound ? 'sent' : 'received',
            created_at: msg.created_time
              ? new Date(String(msg.created_time))
              : new Date(),
          }),
        );
        synced++;

        if (!isOutbound && body.trim()) {
          await this.autoReply.tryReply({
            tenantId: account.tenantId,
            platform: account.platform,
            threadId,
            participantId: saved.participantId,
            participantName: saved.participantName,
            inboundText: body,
            account,
            userId,
          });
        }
      }
    }
    return synced;
  }

  private parseAttachments(raw: unknown): InboxAttachment[] {
    const data = (raw as { data?: unknown[] })?.data ?? [];
    const out: InboxAttachment[] = [];
    for (const item of data) {
      const a = item as {
        mime_type?: string;
        name?: string;
        file_url?: string;
        image_data?: { url?: string };
        video_data?: { url?: string };
      };
      const url = a.file_url ?? a.image_data?.url ?? a.video_data?.url;
      if (url) {
        out.push({
          url,
          type: a.mime_type?.startsWith('video') ? 'video' : 'image',
          name: a.name,
          mimeType: a.mime_type,
        });
      }
    }
    return out;
  }

  private parseReactions(raw: unknown): InboxReaction[] {
    const data = (raw as { data?: unknown[] })?.data ?? [];
    return data.map((r) => {
      const item = r as { reaction?: string; users?: unknown[] };
      return {
        type: String(item.reaction ?? 'like'),
        count: Array.isArray(item.users) ? item.users.length : 1,
      };
    });
  }

  private attachmentPreview(attachments: InboxAttachment[]): string {
    if (!attachments.length) return '';
    const first = attachments[0];
    if (first.type === 'video') return '📹 Video attachment';
    if (first.type === 'image') return '📷 Photo attachment';
    return '📎 Attachment';
  }
}
