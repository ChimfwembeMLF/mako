import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappAccountAuthService } from '../whatsapp/whatsapp-account-auth.service';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { WhatsappMessages } from '../whatsapp/entities/whatsapp_messages.entity';
import { SocialMessages } from './entities/social_messages.entity';
import { scopeWhere } from '../../common/workspace-scope.util';
import { SocialDmAutoReplyService } from './social-dm-auto-reply.service';
import { META_GRAPH_VERSION } from '../../common/meta-graph-version';

@Injectable()
export class SocialDmReplyService {
  constructor(
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    @InjectRepository(SocialMessages)
    private readonly socialMessagesRepo: Repository<SocialMessages>,
    @InjectRepository(WhatsappMessages)
    private readonly waMessagesRepo: Repository<WhatsappMessages>,
    private readonly waAuth: WhatsappAccountAuthService,
    private readonly waMessaging: WhatsappMessagingService,
    private readonly autoReply: SocialDmAutoReplyService,
  ) {}

  /** Suggests a reply to a social DM thread from its recent messages. */
  async draftReply(params: {
    tenantId: string;
    conversationId: string;
    workspaceId?: string;
  }): Promise<{ content: string }> {
    if (!params.conversationId.startsWith('dm:')) {
      throw new NotFoundException('AI drafts are available for Facebook and Instagram messages');
    }
    const [, platform, ...rest] = params.conversationId.split(':');
    const threadId = rest.join(':');
    const recent = await this.socialMessagesRepo.find({
      where: {
        ...scopeWhere<SocialMessages>(params.tenantId, params.workspaceId),
        platform,
        threadId,
      },
      order: { created_at: 'DESC' },
      take: 10,
    });
    if (!recent.some((m) => m.direction === 'inbound' && m.body?.trim())) {
      throw new NotFoundException('No customer message to reply to');
    }
    const transcript = recent
      .reverse()
      .filter((m) => m.body?.trim())
      .map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Us'}: ${m.body.trim()}`)
      .join('\n');
    const content = await this.autoReply.draftReply(
      params.tenantId,
      transcript,
      params.workspaceId,
    );
    return { content };
  }

  async sendReply(params: {
    tenantId: string;
    userId: string;
    conversationId: string;
    message: string;
    workspaceId?: string;
    useTemplate?: boolean;
    templateName?: string;
    templateLanguage?: string;
  }) {
    const text = params.message?.trim();
    if (!text) throw new NotFoundException('Message required');

    if (params.conversationId.startsWith('wa:')) {
      const phone = this.waMessaging.normalizePhone(
        params.conversationId.slice(3),
      );
      const account =
        (await this.socialRepo.findOne({
          where: {
            ...scopeWhere<SocialAccounts>(params.tenantId, params.workspaceId),
            userId: params.userId,
            platform: 'whatsapp',
            connected: true,
          },
        })) ??
        (await this.socialRepo.findOne({
          where: {
            ...scopeWhere<SocialAccounts>(params.tenantId, params.workspaceId),
            platform: 'whatsapp',
            connected: true,
          },
        }));
      if (!account) return { sent: false, message: 'WhatsApp not connected' };

      const result = await this.waAuth.sendReply(account, phone, text, {
        useTemplate: params.useTemplate,
        templateName: params.templateName,
        templateLanguage: params.templateLanguage,
      });
      if (!result.success) {
        return {
          sent: false,
          message: this.waMessaging.humanizeSendError(result.error),
        };
      }

      await this.waMessagesRepo.save(
        this.waMessagesRepo.create({
          tenantId: params.tenantId,
          workspaceId: account.workspaceId ?? params.workspaceId,
          phone,
          direction: 'outbound',
          body: text,
          waMessageId: result.waMessageId,
          status: result.usedTemplate ? 'template' : 'sent',
        }),
      );
      return { sent: true, usedTemplate: result.usedTemplate ?? false };
    }

    if (!params.conversationId.startsWith('dm:')) {
      return { sent: false, message: 'Use comment reply for post threads' };
    }

    const [, platform, ...rest] = params.conversationId.split(':');
    const threadId = rest.join(':');
    if (!platform || !threadId) {
      return { sent: false, message: 'Unknown conversation' };
    }

    const account = await this.socialRepo.findOne({
      where: {
        ...scopeWhere<SocialAccounts>(params.tenantId, params.workspaceId),
        platform,
        connected: true,
      },
    });
    if (!account) {
      return {
        sent: false,
        message: `Connect ${platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : platform} in Social accounts to reply.`,
      };
    }

    const lastInbound = await this.socialMessagesRepo.findOne({
      where: {
        ...scopeWhere<SocialMessages>(params.tenantId, params.workspaceId),
        platform,
        threadId,
        direction: 'inbound',
      },
      order: { created_at: 'DESC' },
    });

    if (platform === 'twitter' || platform === 'x') {
      return this.sendTwitterDm(account, threadId, text, lastInbound);
    }

    const recipientId = lastInbound?.participantId;
    if (!recipientId) {
      return {
        sent: false,
        message: 'This person has not messaged you yet, so Meta does not allow a reply.',
      };
    }

    const token = account.metadata?.page_token ?? account.accessToken;
    if (!token) {
      return {
        sent: false,
        message: 'The connection has expired. Reconnect the account in Social accounts.',
      };
    }

    // Messages for both Messenger and Instagram are sent from the linked Page.
    const pageId = account.metadata?.page_id;
    const endpoint = pageId
      ? `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/messages`
      : `https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`;

    let externalMessageId: string | undefined;
    try {
      const res = await axios.post(
        endpoint,
        { recipient: { id: recipientId }, message: { text } },
        { params: { access_token: token } },
      );
      externalMessageId = res.data?.message_id
        ? String(res.data.message_id)
        : undefined;
    } catch (err) {
      return { sent: false, message: this.metaSendError(err) };
    }

    await this.socialMessagesRepo.save(
      this.socialMessagesRepo.create({
        tenantId: params.tenantId,
        workspaceId: account.workspaceId ?? params.workspaceId,
        platform,
        threadId,
        externalMessageId,
        participantId: recipientId,
        participantName: lastInbound.participantName,
        direction: 'outbound',
        body: text,
        attachments: [],
        reactions: [],
        status: 'sent',
      }),
    );

    // Replying answers everything the customer sent before it.
    await this.socialMessagesRepo.update(
      {
        ...scopeWhere<SocialMessages>(params.tenantId, params.workspaceId),
        platform,
        threadId,
        direction: 'inbound',
        status: 'received',
      },
      { status: 'read' },
    );

    return { sent: true };
  }

  /** Turns a Graph API send error into a message the user can act on. */
  private metaSendError(err: unknown): string {
    if (!axios.isAxiosError(err)) return String(err);
    const e = err.response?.data?.error as
      | { message?: string; code?: number; error_subcode?: number }
      | undefined;
    if (!e) return err.message;
    if (e.error_subcode === 2018278 || e.error_subcode === 2534022) {
      return "Meta only allows replies within 24 hours of the customer's last message. Ask them to message you again.";
    }
    if (e.code === 190) {
      return 'The connection has expired. Reconnect the account in Social accounts.';
    }
    if (e.code === 10 || e.code === 200 || e.code === 230) {
      return `Meta blocked this reply: ${e.message ?? 'missing messaging permission'}. Reconnect the account and allow messaging access.`;
    }
    if (e.code === 551 || e.error_subcode === 1545041) {
      return 'This person is not available to receive messages right now.';
    }
    return e.message ?? err.message;
  }

  private async sendTwitterDm(
    account: SocialAccounts,
    threadId: string,
    text: string,
    lastInbound: SocialMessages | null,
  ) {
    const token = account.accessToken?.trim();
    if (!token) return { sent: false, message: 'X account token missing' };

    const recipientId = lastInbound?.participantId ?? threadId;
    if (!recipientId) return { sent: false, message: 'No recipient found' };

    const platform = account.platform === 'x' ? 'x' : 'twitter';

    try {
      await axios.post(
        `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(recipientId)}/messages`,
        { text },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data ?? err.message)
        : String(err);
      return { sent: false, message: `X DM failed: ${message}` };
    }

    await this.socialMessagesRepo.save(
      this.socialMessagesRepo.create({
        tenantId: account.tenantId,
        workspaceId: account.workspaceId,
        platform,
        threadId,
        participantId: recipientId,
        participantName: lastInbound?.participantName,
        direction: 'outbound',
        body: text,
        attachments: [],
        reactions: [],
        status: 'sent',
      }),
    );

    return { sent: true };
  }
}
