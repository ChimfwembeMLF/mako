import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import {
  SocialMessages,
  InboxAttachment,
} from './entities/social_messages.entity';
import { SocialDmAutoReplyService } from './social-dm-auto-reply.service';

@Injectable()
export class SocialMessagingInboundService {
  private readonly logger = new Logger(SocialMessagingInboundService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly accountsRepo: Repository<SocialAccounts>,
    @InjectRepository(SocialMessages)
    private readonly messagesRepo: Repository<SocialMessages>,
    private readonly autoReply: SocialDmAutoReplyService,
  ) {}

  async handleMetaWebhook(body: unknown): Promise<{ received: boolean }> {
    const payload = body as {
      object?: string;
      entry?: Array<{
        id?: string;
        messaging?: Array<Record<string, unknown>>;
      }>;
    };

    if (payload.object !== 'page' && payload.object !== 'instagram') {
      return { received: true };
    }

    const platform = payload.object === 'instagram' ? 'instagram' : 'facebook';

    for (const entry of payload.entry ?? []) {
      const pageId = entry.id;
      for (const event of entry.messaging ?? []) {
        await this.processMessagingEvent(platform, pageId, event);
      }
    }

    return { received: true };
  }

  private async processMessagingEvent(
    platform: string,
    pageId: string | undefined,
    event: Record<string, unknown>,
  ) {
    const message = event.message as Record<string, unknown> | undefined;
    if (!message) return;

    const sender = event.sender as { id?: string } | undefined;
    const senderId = sender?.id;
    if (!senderId) return;

    // entry.id is the Page id (Messenger) or the Instagram account id (Instagram).
    // Only workspaces that connected the receiving account may store it.
    const accounts = await this.findReceivingAccounts(platform, pageId);
    if (!accounts.length) {
      this.logger.warn(
        `Inbound ${platform} message for ${pageId ?? 'unknown'} has no connected account`,
      );
      return;
    }

    for (const account of accounts) {
      await this.saveInbound(account, platform, event, message, senderId, pageId);
    }
  }

  private async findReceivingAccounts(
    platform: string,
    entryId?: string,
  ): Promise<SocialAccounts[]> {
    if (!entryId) return [];
    const qb = this.accountsRepo
      .createQueryBuilder('a')
      .where('a.platform = :platform', { platform })
      .andWhere('a.connected = true');
    if (platform === 'instagram') {
      qb.andWhere(
        `(a.externalId = :id OR a.metadata->>'instagram_business_account_id' = :id OR a.metadata->>'page_id' = :id)`,
        { id: entryId },
      );
    } else {
      qb.andWhere(`(a.metadata->>'page_id' = :id OR a.externalId = :id)`, {
        id: entryId,
      });
    }
    return qb.getMany();
  }

  private async saveInbound(
    account: SocialAccounts,
    platform: string,
    event: Record<string, unknown>,
    message: Record<string, unknown>,
    senderId: string,
    entryId?: string,
  ) {
    const externalId = String(message.mid ?? message.id ?? '');
    if (externalId) {
      const exists = await this.messagesRepo.findOne({
        where: {
          tenantId: account.tenantId,
          ...(account.workspaceId ? { workspaceId: account.workspaceId } : {}),
          platform,
          externalMessageId: externalId,
        },
      });
      if (exists) return;
    }

    const ownIds = new Set(
      [
        entryId,
        account.externalId,
        account.metadata?.page_id,
        account.metadata?.instagram_business_account_id,
      ]
        .filter(Boolean)
        .map(String),
    );
    const isOutbound = Boolean(message.is_echo) || ownIds.has(senderId);
    const attachments = this.parseMessageAttachments(message.attachments);
    const body =
      String(message.text ?? '') ||
      (attachments.length ? this.attachmentLabel(attachments[0]) : '');

    const threadId = isOutbound
      ? String((event.recipient as { id?: string })?.id ?? senderId)
      : senderId;

    const saved = await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: account.tenantId,
        workspaceId: account.workspaceId,
        platform,
        threadId,
        externalMessageId: externalId || undefined,
        participantId: isOutbound ? threadId : senderId,
        direction: isOutbound ? 'outbound' : 'inbound',
        body,
        attachments,
        reactions: [],
        status: isOutbound ? 'sent' : 'received',
      }),
    );

    if (!isOutbound && body.trim()) {
      await this.autoReply.tryReply({
        tenantId: account.tenantId,
        platform,
        threadId,
        participantId: saved.participantId,
        inboundText: body,
        account,
      });
    }
  }

  private parseMessageAttachments(raw: unknown): InboxAttachment[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const a = item as {
          type?: string;
          payload?: { url?: string };
        };
        return {
          url: a.payload?.url,
          type: a.type ?? 'file',
          mimeType: a.type,
        };
      })
      .filter((a) => a.url || a.type);
  }

  private attachmentLabel(a: InboxAttachment): string {
    if (a.type === 'image') return '📷 Photo';
    if (a.type === 'video') return '📹 Video';
    if (a.type === 'audio') return '🎵 Audio';
    if (a.type === 'file') return '📎 File';
    return '📎 Attachment';
  }
}
