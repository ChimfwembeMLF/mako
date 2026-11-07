import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenants } from '../tenants/entities/tenants.entity';
import { LeadsService } from '../leads/leads.service';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { LeadClassifyService } from '../leads/services/lead-classify.service';

/** Short replies that say nothing new about the lead ("ok", "thanks", "👍"). */
const SMALL_TALK = /^(ok(ay)?|k|yes|no|yep|nope|sure|thanks?( you)?|thank you|thx|ty|cool|great|nice|hi|hello|hey|bye|good( morning| afternoon| evening)?|alright|noted|👍|🙏|❤️|😊)[\s.!?]*$/i;

/** How long after a classification a lead is left alone, unless something long comes in. */
const RECLASSIFY_AFTER_MS = 6 * 3600_000;

/**
 * Whether a new message is worth an AI call to (re)classify the lead. A lead's first real
 * message always is; after that, only a substantial message once the last label is stale.
 */
export function worthClassifying(message: string, lead: { classification?: string }, lastClassifiedAt?: number): boolean {
  const text = message.trim();
  if (!text || SMALL_TALK.test(text) || /^📎|^📷/.test(text)) return false;
  const words = text.split(/\s+/).length;
  if (!lead.classification || lead.classification === 'inbound') return words >= 3;
  if (words < 8) return false;
  return !lastClassifiedAt || Date.now() - lastClassifiedAt > RECLASSIFY_AFTER_MS;
}

@Injectable()
export class WhatsappLeadService {
  private readonly logger = new Logger(WhatsappLeadService.name);
  /** When each lead was last classified in this process (keeps repeat calls down). */
  private readonly classifiedAt = new Map<string, number>();

  constructor(
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    @InjectRepository(WhatsappContacts)
    private readonly contactsRepo: Repository<WhatsappContacts>,
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
    private readonly leads: LeadsService,
    private readonly classify: LeadClassifyService,
  ) {}

  async captureInbound(params: {
    tenantId: string;
    contact: WhatsappContacts;
    message: string;
    messageRowId: string;
  }): Promise<string | undefined> {
    const tenant = await this.tenantsRepo.findOne({
      where: { id: params.tenantId },
    });
    if (!tenant?.ownerId) return params.contact.leadId;

    const lead = await this.leads.upsertFromWhatsapp({
      tenantId: params.tenantId,
      userId: tenant.ownerId,
      phone: params.contact.phone,
      name: params.contact.name,
      message: params.message,
    });

    if (params.contact.leadId !== lead.id) {
      await this.contactsRepo.update(params.contact.id, { leadId: lead.id });
      params.contact.leadId = lead.id;
    }

    await this.messagesRepo.update(params.messageRowId, { leadId: lead.id });

    if (!worthClassifying(params.message, lead, this.classifiedAt.get(lead.id))) {
      return lead.id;
    }
    this.classifiedAt.set(lead.id, Date.now());
    if (this.classifiedAt.size > 10_000) this.classifiedAt.clear();

    void this.classify
      .classify({
        tenantId: params.tenantId,
        userId: tenant.ownerId,
        name: params.contact.name ?? `WhatsApp ${params.contact.phone}`,
        email: `wa+${params.contact.phone.replace(/\D/g, '')}@inbox.mako`,
        message: params.message,
      })
      .then(async (result) => {
        if (result?.label) {
          await this.leads.update(lead.id, {
            classification: result.label,
            aiReply: result.suggestedReply || undefined,
          });
        }
      })
      .catch((err) => {
        this.logger.warn(
          `Lead classify skipped: ${err instanceof Error ? err.message : err}`,
        );
      });

    return lead.id;
  }
}
