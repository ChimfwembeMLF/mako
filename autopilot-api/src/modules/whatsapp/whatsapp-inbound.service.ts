import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappLeadService } from './whatsapp-lead.service';
import { WhatsappAutoReplyService } from './whatsapp-auto-reply.service';

@Injectable()
export class WhatsappInboundService {
  private readonly logger = new Logger(WhatsappInboundService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly accountsRepo: Repository<SocialAccounts>,
    @InjectRepository(WhatsappContacts)
    private readonly contactsRepo: Repository<WhatsappContacts>,
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
    private readonly messaging: WhatsappMessagingService,
    private readonly leads: WhatsappLeadService,
    private readonly autoReply: WhatsappAutoReplyService,
  ) {}

  async handleMetaWebhook(body: unknown): Promise<{ received: boolean }> {
    const payload = body as {
      object?: string;
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string; display_phone_number?: string };
            messages?: Array<{
              id?: string;
              from?: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
            }>;
            statuses?: Array<{ id?: string; status?: string; recipient_id?: string }>;
          };
        }>;
      }>;
    };

    if (payload.object !== 'whatsapp_business_account') {
      return { received: true };
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id;

        for (const msg of value.messages ?? []) {
          if (!msg.from) continue;

          const { tenantId, account } = await this.resolveInboundContext(
            phoneNumberId,
            msg.from,
          );
          if (!tenantId) continue;

          const text = msg.text?.body ?? (msg.type === 'text' ? '' : `[${msg.type} message]`);
          if (!text && msg.type !== 'text') continue;

          await this.processInbound({
            tenantId,
            fromPhone: msg.from,
            body: text,
            waMessageId: msg.id,
            account,
          });
        }
      }
    }

    return { received: true };
  }

  private async processInbound(params: {
    tenantId: string;
    fromPhone: string;
    body: string;
    waMessageId?: string;
    account?: SocialAccounts | null;
  }) {
    if (params.waMessageId) {
      const existing = await this.messagesRepo.findOne({
        where: { waMessageId: params.waMessageId },
      });
      if (existing) return;
    }

    const phone = this.messaging.normalizePhone(params.fromPhone);
    let contact = await this.contactsRepo.findOne({
      where: { tenantId: params.tenantId, phone },
    });
    if (!contact) {
      contact = await this.contactsRepo.save(
        this.contactsRepo.create({
          tenantId: params.tenantId,
          phone,
          optedIn: true,
          optedInAt: new Date(),
          tags: ['inbound'],
        }),
      );
    }

    const savedMessage = await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: params.tenantId,
        contactId: contact.id,
        phone,
        direction: 'inbound',
        body: params.body,
        waMessageId: params.waMessageId,
        status: 'received',
      }),
    );

    const leadId = await this.leads.captureInbound({
      tenantId: params.tenantId,
      contact,
      message: params.body,
      messageRowId: savedMessage.id,
    });

    this.logger.log(`WhatsApp inbound from ${phone} (tenant ${params.tenantId})`);

    const creds = params.account
      ? this.messaging.credentialsFromAccount(params.account)
      : null;
    if (creds) {
      await this.autoReply.tryReply({
        tenantId: params.tenantId,
        phone,
        inboundText: params.body,
        creds,
        contactId: contact.id,
        leadId,
      });
    }
  }

  private async resolveInboundContext(
    phoneNumberId: string | undefined,
    fromPhone: string,
  ): Promise<{ tenantId?: string; account: SocialAccounts | null }> {
    const platform = this.messaging.getPlatformCredentials();

    if (platform && phoneNumberId === platform.phoneNumberId) {
      const tenantId = await this.resolvePlatformTenantForInbound(fromPhone);
      if (!tenantId) {
        return { tenantId: undefined, account: null };
      }
      const account = await this.accountsRepo.findOne({
        where: { tenantId, platform: 'whatsapp', connected: true },
      });
      return { tenantId, account };
    }

    const account = phoneNumberId
      ? await this.resolveAccountByPhoneNumberId(phoneNumberId)
      : null;
    return { tenantId: account?.tenantId, account };
  }

  private async resolvePlatformTenantForInbound(fromPhone: string): Promise<string | undefined> {
    const phone = this.messaging.normalizePhone(fromPhone);

    const contacts = await this.contactsRepo.find({ where: { phone } });
    if (contacts.length === 1) return contacts[0].tenantId;
    if (contacts.length > 1) {
      const recent = await this.messagesRepo.findOne({
        where: { phone },
        order: { created_at: 'DESC' },
      });
      return recent?.tenantId ?? contacts[0].tenantId;
    }

    const recentOutbound = await this.messagesRepo.findOne({
      where: { phone, direction: 'outbound' },
      order: { created_at: 'DESC' },
    });
    if (recentOutbound?.tenantId) return recentOutbound.tenantId;

    const platformAccounts = await this.accountsRepo.find({
      where: { platform: 'whatsapp', connected: true },
    });
    const enabled = platformAccounts.filter((a) => a.metadata?.platform_managed === true);
    if (enabled.length === 1) return enabled[0].tenantId;

    return undefined;
  }

  private async resolveAccountByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<SocialAccounts | null> {
    const accounts = await this.accountsRepo.find({
      where: { platform: 'whatsapp', connected: true },
    });
    return accounts.find((a) => a.metadata?.phone_number_id === phoneNumberId) ?? null;
  }
}
