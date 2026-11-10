import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenants } from '../tenants/entities/tenants.entity';
import { LeadsService } from '../leads/leads.service';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { LeadClassifyService } from '../leads/services/lead-classify.service';

import { worthClassifying } from '../leads/lead-signal';

export { worthClassifying };

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
