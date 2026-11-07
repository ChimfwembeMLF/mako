import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tenants } from '../tenants/entities/tenants.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappLeadService } from './whatsapp-lead.service';
import { WhatsappAutoReplyService } from './whatsapp-auto-reply.service';
import { WhatsappBotsService } from './bots/whatsapp-bots.service';
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

/** "ref:acme" in a customer's first message picks the workspace on the shared Mako number. */
const SHARED_NUMBER_REF = /\bref[:#\s]+([a-z0-9][a-z0-9-]{1,62})\b/i;

/** The text a business's customers send first on the shared number, so they reach the right workspace. */
export function sharedNumberGreeting(businessName: string, slug: string): string {
  return `Hi ${businessName}! (ref:${slug})`;
}

@Injectable()
export class WhatsappInboundService {
  private readonly logger = new Logger(WhatsappInboundService.name);
  /** Messages from the same customer are handled one at a time, in the order they arrive. */
  private readonly conversations = new Map<string, Promise<unknown>>();

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly accountsRepo: Repository<SocialAccounts>,
    @InjectRepository(WhatsappContacts)
    private readonly contactsRepo: Repository<WhatsappContacts>,
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    private readonly messaging: WhatsappMessagingService,
    private readonly leads: WhatsappLeadService,
    private readonly autoReply: WhatsappAutoReplyService,
    private readonly flowEngine: WhatsappFlowEngineService,
    private readonly bots: WhatsappBotsService,
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
          const from = msg.from;
          const parsed = this.parseInboundMessage(msg);
          if (!parsed) continue;

          await this.inOrder(`${phoneNumberId ?? ''}:${from}`, async () => {
            const { tenantId, account } = await this.resolveInboundContext(
              phoneNumberId,
              from,
              parsed.text,
            );
            if (!tenantId) return;

            await this.processInbound({
              tenantId,
              fromPhone: from,
              body: parsed.text,
              interactiveId: parsed.interactiveId,
              waMessageId: msg.id,
              account,
              attachments: parsed.mediaAttachment ? [parsed.mediaAttachment] : [],
            });
          });
        }

        for (const status of value.statuses ?? []) {
          await this.processDeliveryStatus(status);
        }
      }
    }

    return { received: true };
  }

  /**
   * Runs one customer's messages one after another. Meta can deliver two quick messages
   * at once; handled together, both would read the same bot step and answer twice.
   */
  private inOrder(key: string, task: () => Promise<void>): Promise<void> {
    const previous = this.conversations.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.conversations.set(key, current);
    void current
      .catch(() => undefined)
      .finally(() => {
        if (this.conversations.get(key) === current) this.conversations.delete(key);
      });
    return current;
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
    const workspaceId = params.account?.workspaceId ?? undefined;
    let contact = await this.contactsRepo.findOne({
      where: { tenantId: params.tenantId, phone },
    });
    if (!contact) {
      contact = await this.contactsRepo.save(
        this.contactsRepo.create({
          tenantId: params.tenantId,
          workspaceId,
          phone,
          optedIn: true,
          optedInAt: new Date(),
          tags: ['inbound'],
        }),
      );
    } else if (workspaceId && !contact.workspaceId) {
      contact.workspaceId = workspaceId;
      await this.contactsRepo.save(contact);
    }

    const savedMessage = await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: params.tenantId,
        workspaceId,
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
      // Live visual bots come first; the older menu bot runs only when none apply.
      const handledByBot = await this.bots.tryHandleInbound({
        tenantId: params.tenantId,
        workspaceId,
        phone,
        text: params.body,
        interactiveId: params.interactiveId,
        creds,
        contactId: contact.id,
        leadId,
      });
      if (handledByBot) return;

      // The classic menu bot is being retired: it only answers in workspaces without a live
      // visual bot, so the two never compete. Keyword auto-replies still apply.
      const classicAllowed = !(await this.bots.hasLiveBot(params.tenantId, workspaceId));
      const handledByFlow = classicAllowed && await this.flowEngine.tryHandleInbound({
        tenantId: params.tenantId,
        workspaceId,
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
    text: string,
  ): Promise<{ tenantId?: string; account: SocialAccounts | null }> {
    const platform = this.messaging.getPlatformCredentials();

    if (platform && phoneNumberId === platform.phoneNumberId) {
      const tenantId = await this.resolvePlatformTenantForInbound(fromPhone, text);
      if (!tenantId) {
        await this.askForSharedNumberRef(platform, fromPhone);
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

  /**
   * Which workspace a message on the shared Mako number belongs to. A "ref:<code>" in the
   * message wins (it comes from the business's chat link), then the workspace this
   * customer last spoke with, then the only workspace on the shared number.
   */
  private async resolvePlatformTenantForInbound(
    fromPhone: string,
    text: string,
  ): Promise<string | undefined> {
    const phone = this.messaging.normalizePhone(fromPhone);
    const managed = await this.platformManagedTenantIds();

    const ref = SHARED_NUMBER_REF.exec(text)?.[1]?.toLowerCase();
    if (ref && managed.length) {
      const tenant = await this.tenantsRepo.findOne({ where: { slug: ref, id: In(managed) } });
      if (tenant) return tenant.id;
    }

    const recent = await this.messagesRepo.findOne({
      where: { phone },
      order: { created_at: 'DESC' },
    });
    if (recent?.tenantId) return recent.tenantId;

    const contacts = await this.contactsRepo.find({ where: { phone } });
    if (contacts.length) return contacts[0].tenantId;

    if (managed.length === 1) return managed[0];
    return undefined;
  }

  private async platformManagedTenantIds(): Promise<string[]> {
    const accounts = await this.accountsRepo.find({
      where: { platform: 'whatsapp', connected: true },
    });
    return [
      ...new Set(
        accounts
          .filter((a) => a.metadata?.platform_managed === true)
          .map((a) => a.tenantId),
      ),
    ];
  }

  /** Recently asked, by phone, so a customer isn't sent the same prompt for every message. */
  private readonly refPrompts = new Map<string, number>();

  /**
   * A new customer wrote to the shared number without a business code. Rather than drop
   * the message silently, ask them to use the business's link. Names are never listed,
   * so customers can't see which businesses use the number.
   */
  private async askForSharedNumberRef(
    creds: { phoneNumberId: string; accessToken: string },
    fromPhone: string,
  ) {
    const phone = this.messaging.normalizePhone(fromPhone);
    const last = this.refPrompts.get(phone) ?? 0;
    if (Date.now() - last < 6 * 3600_000) return;
    this.refPrompts.set(phone, Date.now());
    if (this.refPrompts.size > 5000) this.refPrompts.clear();
    this.logger.warn(
      `Shared WhatsApp number: no workspace for ${phone.slice(0, -4)}**** (no ref code); asked the customer for one`,
    );
    await this.messaging
      .sendSessionText(
        creds,
        phone,
        "Hi! This number is shared by several businesses, so we couldn't tell who you're trying to reach. Please open the WhatsApp link the business shared with you, or reply with their code like this: ref:their-code",
      )
      .catch(() => undefined);
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
