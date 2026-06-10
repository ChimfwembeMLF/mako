import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  PublishResult,
  ContentToPublish,
} from '../content-publishing/interfaces/publish-result.interface';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';

@Injectable()
export class WhatsappPublishingService {
  private readonly logger = new Logger(WhatsappPublishingService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    private readonly messaging: WhatsappMessagingService,
    private readonly config: ConfigService,
    @InjectRepository(WhatsappContacts)
    private readonly contactsRepo: Repository<WhatsappContacts>,
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
  ) {}

  async publishPost(
    content: ContentToPublish,
    _media: unknown[] = [],
    options?: { templateName?: string; templateLanguage?: string; useTemplate?: boolean },
  ): Promise<PublishResult> {
    const account = await this.resolveAccount(content.tenantId, content.userId);
    if (!account) {
      return { published: false, message: 'WhatsApp Business not connected — add credentials in Publisher Connect' };
    }

    const creds = this.messaging.credentialsFromAccount(account);
    if (!creds) {
      return {
        published: false,
        message: 'WhatsApp phone_number_id or access_token missing — reconnect WhatsApp',
      };
    }

    const contacts = await this.contactsRepo.find({
      where: { tenantId: content.tenantId, optedIn: true },
    });
    if (!contacts.length) {
      return {
        published: false,
        message: 'No opted-in WhatsApp contacts — add contacts in Lead Agent and mark them opted in',
      };
    }

    const plainText = [content.title, content.content.replace(/<[^>]*>/g, '')]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    const useTemplate =
      options?.useTemplate !== false &&
      this.config.get<string>('WHATSAPP_USE_TEMPLATE_BROADCAST') !== 'false';
    const templateName =
      options?.templateName?.trim() ||
      this.config.get<string>('WHATSAPP_BROADCAST_TEMPLATE')?.trim();
    const templateLanguage = options?.templateLanguage?.trim() || 'en';

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      const result = useTemplate
        ? await this.messaging.sendTemplateText(
            creds,
            contact.phone,
            plainText,
            templateName,
            templateLanguage,
          )
        : await this.messaging.sendSessionText(creds, contact.phone, plainText);

      if (!result.success && useTemplate) {
        const retry = await this.messaging.sendSessionText(creds, contact.phone, plainText);
        if (retry.success) {
          await this.persistOutbound(content.tenantId, contact, plainText, retry.waMessageId);
          sent++;
          continue;
        }
      }

      if (result.success) {
        await this.persistOutbound(content.tenantId, contact, plainText, result.waMessageId);
        sent++;
      } else {
        failed++;
        if (result.error && errors.length < 3) errors.push(`${contact.phone}: ${result.error}`);
      }
    }

    if (sent === 0) {
      return {
        published: false,
        message: `WhatsApp broadcast failed for all ${contacts.length} contacts. ${errors.join('; ')}`,
      };
    }

    const summary = `WhatsApp: sent to ${sent}/${contacts.length} opted-in contact(s)` +
      (failed ? ` (${failed} failed)` : '');

    this.logger.log(summary);
    return {
      published: true,
      message: summary,
      externalPostId: `wa-broadcast-${Date.now()}`,
    };
  }

  private async resolveAccount(tenantId: string, userId: string) {
    return (
      (await this.socialRepo.findOne({
        where: { tenantId, userId, platform: 'whatsapp', connected: true },
      })) ??
      (await this.socialRepo.findOne({
        where: { tenantId, platform: 'whatsapp', connected: true },
      }))
    );
  }

  private async persistOutbound(
    tenantId: string,
    contact: WhatsappContacts,
    body: string,
    waMessageId?: string,
  ) {
    await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId,
        contactId: contact.id,
        phone: contact.phone,
        direction: 'outbound',
        body,
        waMessageId,
        status: 'sent',
      }),
    );
  }
}
