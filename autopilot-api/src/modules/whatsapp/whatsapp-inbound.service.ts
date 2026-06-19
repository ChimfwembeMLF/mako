import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappLeadService } from './whatsapp-lead.service';
import { WhatsappAutoReplyService } from './whatsapp-auto-reply.service';
import { WhatsappFlowEngineService } from './whatsapp-flow-engine.service';

type InboundWaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
};

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
    private readonly flowEngine: WhatsappFlowEngineService,
  ) {}

  async handleMetaWebhook(body: unknown): Promise<{ received: boolean }> {
    const payload = body as {
      object?: string;
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: {
              phone_number_id?: string;
              display_phone_number?: string;
            };
            messages?: InboundWaMessage[];
            statuses?: Array<{
              id?: string;
              status?: string;
              recipient_id?: string;
            }>;
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

          const parsed = this.parseInboundMessage(msg);
          if (!parsed) continue;

          await this.processInbound({
            tenantId,
            fromPhone: msg.from,
            body: parsed.text,
            interactiveId: parsed.interactiveId,
            waMessageId: msg.id,
            account,
            attachments: parsed.mediaAttachment ? [parsed.mediaAttachment] : [],
          });
        }

        for (const status of value.statuses ?? []) {
          await this.processDeliveryStatus(status);
        }
      }
    }

    return { received: true };
  }

  private parseInboundMessage(msg: InboundWaMessage): {
    text: string;
    interactiveId?: string;
    mediaAttachment?: {
      mediaId: string;
      type: string;
      mimeType?: string;
      name?: string;
    };
  } | null {
    if (msg.type === 'text' && msg.text?.body) {
      return { text: msg.text.body };
    }

    if (msg.type === 'interactive' && msg.interactive) {
      const buttonId = msg.interactive.button_reply?.id;
      const listId = msg.interactive.list_reply?.id;
      const interactiveId = buttonId || listId;
      const label =
        msg.interactive.button_reply?.title ||
        msg.interactive.list_reply?.title ||
        interactiveId ||
        '';
      if (interactiveId) {
        return { text: label, interactiveId };
      }
    }

    if (
      msg.type === 'button' &&
      (msg as { button?: { text?: string; payload?: string } }).button
    ) {
      const button = (msg as { button?: { text?: string; payload?: string } })
        .button;
      return { text: button?.text ?? '', interactiveId: button?.payload };
    }

    const mediaTypes = [
      'image',
      'video',
      'audio',
      'document',
      'sticker',
    ] as const;
    for (const t of mediaTypes) {
      const media = (
        msg as Record<
          string,
          { id?: string; mime_type?: string; filename?: string }
        >
      )[t];
      if (msg.type === t && media?.id) {
        return {
          text:
            t === 'document' ? `📎 ${media.filename ?? 'Document'}` : `📷 ${t}`,
          mediaAttachment: {
            mediaId: media.id,
            type: t,
            mimeType: media.mime_type,
            name: media.filename,
          },
        };
      }
    }

    return null;
  }

  private async processDeliveryStatus(status: {
    id?: string;
    status?: string;
    recipient_id?: string;
    errors?: Array<{ code?: number; title?: string; message?: string }>;
  }) {
    if (!status.id) return;

    const row = await this.messagesRepo.findOne({
      where: { waMessageId: status.id },
    });
    if (!row) return;

    const deliveryStatus = status.status?.toLowerCase();
    if (deliveryStatus) {
      row.status = deliveryStatus;
    }

    if (deliveryStatus === 'failed') {
      const err = status.errors?.[0];
      row.errorMessage =
        err?.message ??
        err?.title ??
        `WhatsApp delivery failed (code ${err?.code ?? '?'})`;
      this.logger.warn(
        `WhatsApp delivery failed → ${row.phone}: ${row.errorMessage} (wamid ${status.id})`,
      );
    } else if (deliveryStatus === 'delivered' || deliveryStatus === 'read') {
      row.errorMessage = undefined;
    }

    await this.messagesRepo.save(row);
  }

  private async processInbound(params: {
    tenantId: string;
    fromPhone: string;
    body: string;
    interactiveId?: string;
    waMessageId?: string;
    account?: SocialAccounts | null;
    attachments?: Array<{
      mediaId: string;
      type: string;
      mimeType?: string;
      name?: string;
    }>;
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
        attachments: (params.attachments ?? []).map((a) => ({
          type: a.type,
          name: a.name,
          mimeType: a.mimeType,
          mediaId: a.mediaId,
        })),
        reactions: [],
      }),
    );

    const leadId = await this.leads.captureInbound({
      tenantId: params.tenantId,
      contact,
      message: params.body,
      messageRowId: savedMessage.id,
    });

    this.logger.log(
      `WhatsApp inbound from ${phone} (tenant ${params.tenantId})`,
    );

    const creds = params.account
      ? this.messaging.credentialsFromAccount(params.account)
      : null;
    if (creds) {
      const handledByFlow = await this.flowEngine.tryHandleInbound({
        tenantId: params.tenantId,
        phone,
        text: params.body,
        interactiveId: params.interactiveId,
        creds,
        contactId: contact.id,
        leadId,
      });
      if (handledByFlow) return;

      await this.autoReply.tryReply({
        tenantId: params.tenantId,
        phone,
        inboundText: params.body,
        account: params.account,
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

  private async resolvePlatformTenantForInbound(
    fromPhone: string,
  ): Promise<string | undefined> {
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
    const enabled = platformAccounts.filter(
      (a) => a.metadata?.platform_managed === true,
    );
    if (enabled.length === 1) return enabled[0].tenantId;

    return undefined;
  }

  private async resolveAccountByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<SocialAccounts | null> {
    const accounts = await this.accountsRepo.find({
      where: { platform: 'whatsapp', connected: true },
    });
    return (
      accounts.find((a) => a.metadata?.phone_number_id === phoneNumberId) ??
      null
    );
  }
}
