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
  ) {}

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

    const [, platform, threadId] = params.conversationId.split(':');
    const account = await this.socialRepo.findOne({
      where: {
        ...scopeWhere<SocialAccounts>(params.tenantId, params.workspaceId),
        platform,
        connected: true,
      },
    });
    if (!account) return { sent: false, message: `${platform} not connected` };

    const lastInbound = await this.socialMessagesRepo.findOne({
      where: {
        tenantId: params.tenantId,
        platform,
        threadId,
        direction: 'inbound',
      },
      order: { created_at: 'DESC' },
    });
    const recipientId = lastInbound?.participantId;
    if (!recipientId) return { sent: false, message: 'No recipient found' };

    const token = account.metadata?.page_token ?? account.accessToken;
    await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      { recipient: { id: recipientId }, message: { text } },
      { params: { access_token: token } },
    );

    await this.socialMessagesRepo.save(
      this.socialMessagesRepo.create({
        tenantId: params.tenantId,
        workspaceId: account.workspaceId ?? params.workspaceId,
        platform,
        threadId,
        participantId: recipientId,
        participantName: lastInbound.participantName,
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
