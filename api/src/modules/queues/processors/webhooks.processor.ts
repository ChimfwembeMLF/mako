import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';
import {
  QUEUE_WEBHOOKS,
  JOB_WHATSAPP_INBOUND,
  JOB_LEAD_WEBHOOK,
  WhatsappInboundJobData,
  LeadWebhookJobData,
} from '../queue.constants';
import { WhatsappInboundService } from '../../whatsapp/whatsapp-inbound.service';
import { SocialMessagingInboundService } from '../../social_inbox/social-messaging-inbound.service';
import { LeadsService } from '../../leads/leads.service';
import { LeadClassifyService } from '../../leads/services/lead-classify.service';
import { LeadSourcesService } from '../../lead_sources/lead_sources.service';

@Processor(QUEUE_WEBHOOKS)
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    private readonly whatsappInbound: WhatsappInboundService,
    private readonly moduleRef: ModuleRef,
    private readonly leads: LeadsService,
    private readonly classify: LeadClassifyService,
    private readonly leadSources: LeadSourcesService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOB_WHATSAPP_INBOUND: {
        // Every Meta webhook is queued under this job: route Facebook and Instagram DMs too.
        const body = (job as Job<WhatsappInboundJobData>).data.body;
        const object = (body as { object?: string })?.object;
        if (object === 'page' || object === 'instagram') {
          return this.socialInbound().handleMetaWebhook(body);
        }
        return this.whatsappInbound.handleMetaWebhook(body);
      }
      case JOB_LEAD_WEBHOOK:
        return this.handleLeadWebhook(job as Job<LeadWebhookJobData>);
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
        return null;
    }
  }

  /**
   * Looked up when needed: importing the social inbox module here would make a module
   * cycle (social inbox → comment replies → queues).
   */
  private socialInbound(): SocialMessagingInboundService {
    return this.moduleRef.get(SocialMessagingInboundService, { strict: false });
  }

  private async handleLeadWebhook(job: Job<LeadWebhookJobData>) {
    const { sourceId, payload } = job.data;
    const source = await this.leadSources.findOne(sourceId);

    const classification = await this.classify.classify({
      tenantId: source.tenantId,
      userId: source.userId,
      name: String(payload.name ?? 'Unknown'),
      email: String(payload.email ?? ''),
      message: String(payload.message ?? ''),
    });

    const lead = await this.leads.create({
      tenantId: source.tenantId,
      userId: source.userId,
      name: String(payload.name ?? 'Unknown'),
      email: String(payload.email ?? ''),
      source: String(payload.source ?? source.label),
      message: payload.message as string | undefined,
      classification: classification.label,
      status: 'new',
      aiReply: classification.suggestedReply,
    } as any);

    return { ok: true, leadId: lead.id, classification: classification.label };
  }
}
