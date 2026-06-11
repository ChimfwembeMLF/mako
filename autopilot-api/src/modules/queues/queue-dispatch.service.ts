import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_AI,
  QUEUE_COMMENTS,
  QUEUE_CONTENT_PUBLISH,
  QUEUE_EMAIL,
  QUEUE_WEBHOOKS,
  JOB_AI_TASK,
  JOB_AUTO_PUBLISH_SCAN,
  JOB_AUTO_PUBLISH_TENANT,
  JOB_LEAD_WEBHOOK,
  JOB_PUBLISH_CONTENT,
  JOB_SEND_EMAIL,
  JOB_SYNC_ALL_COMMENTS,
  JOB_SYNC_TENANT_COMMENTS,
  JOB_WHATSAPP_INBOUND,
  AiTaskJobData,
  IngestDocumentJobData,
  JOB_INGEST_DOCUMENT,
  AutoPublishTenantJobData,
  LeadWebhookJobData,
  PublishContentJobData,
  SendEmailJobData,
  SyncTenantCommentsJobData,
  WhatsappInboundJobData,
} from './queue.constants';

@Injectable()
export class QueueDispatchService {
  private readonly logger = new Logger(QueueDispatchService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_CONTENT_PUBLISH) private readonly publishQueue: Queue,
    @InjectQueue(QUEUE_COMMENTS) private readonly commentsQueue: Queue,
    @InjectQueue(QUEUE_WEBHOOKS) private readonly webhooksQueue: Queue,
    @InjectQueue(QUEUE_AI) private readonly aiQueue: Queue,
    @InjectQueue(QUEUE_EMAIL) private readonly emailQueue: Queue,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('QUEUES_ENABLED') !== 'false';
  }

  async enqueuePublish(data: PublishContentJobData) {
    const job = await this.publishQueue.add(JOB_PUBLISH_CONTENT, data, {
      jobId: `publish-${data.tenantId}-${data.contentId}-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    return { jobId: job.id, queue: QUEUE_CONTENT_PUBLISH };
  }

  /** @deprecated Use fanOutAutoPublishTenants — one job per tenant */
  async enqueueAutoPublishScan() {
    const job = await this.publishQueue.add(
      JOB_AUTO_PUBLISH_SCAN,
      {},
      {
        jobId: `auto-publish-scan-${Math.floor(Date.now() / 60000)}`,
        attempts: 2,
        removeOnComplete: 20,
      },
    );
    return { jobId: job.id, queue: QUEUE_CONTENT_PUBLISH };
  }

  async enqueueAutoPublishTenant(data: AutoPublishTenantJobData) {
    const minute = Math.floor(Date.now() / 60000);
    const job = await this.publishQueue.add(JOB_AUTO_PUBLISH_TENANT, data, {
      jobId: `auto-publish-${data.tenantId}-${minute}`,
      attempts: 2,
      removeOnComplete: 50,
    });
    return { jobId: job.id, queue: QUEUE_CONTENT_PUBLISH };
  }

  async fanOutAutoPublishTenants(tenantIds: string[]) {
    const jobs: Array<{ tenantId: string; jobId: string | number | undefined }> = [];
    for (const tenantId of tenantIds) {
      const { jobId } = await this.enqueueAutoPublishTenant({ tenantId });
      jobs.push({ tenantId, jobId });
    }
    return { enqueued: jobs.length, jobs };
  }

  async fanOutCommentSync(tenants: SyncTenantCommentsJobData[]) {
    const jobs: Array<{ tenantId: string; jobId: string | number | undefined }> = [];
    for (const data of tenants) {
      const { jobId } = await this.enqueueSyncTenantComments(data);
      jobs.push({ tenantId: data.tenantId, jobId });
    }
    return { enqueued: jobs.length, jobs };
  }

  async enqueueSyncTenantComments(data: SyncTenantCommentsJobData) {
    const job = await this.commentsQueue.add(JOB_SYNC_TENANT_COMMENTS, data, {
      jobId: `comments-${data.tenantId}-${Math.floor(Date.now() / 60000)}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 50,
    });
    return { jobId: job.id, queue: QUEUE_COMMENTS };
  }

  async enqueueSyncAllComments() {
    const job = await this.commentsQueue.add(
      JOB_SYNC_ALL_COMMENTS,
      {},
      {
        jobId: `comments-all-${Math.floor(Date.now() / 60000)}`,
        attempts: 2,
        removeOnComplete: 20,
      },
    );
    return { jobId: job.id, queue: QUEUE_COMMENTS };
  }

  async enqueueWhatsappInbound(data: WhatsappInboundJobData) {
    const job = await this.webhooksQueue.add(JOB_WHATSAPP_INBOUND, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
    return { jobId: job.id, queue: QUEUE_WEBHOOKS };
  }

  async enqueueLeadWebhook(data: LeadWebhookJobData) {
    const job = await this.webhooksQueue.add(JOB_LEAD_WEBHOOK, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
    });
    return { jobId: job.id, queue: QUEUE_WEBHOOKS };
  }

  async enqueueEmail(data: SendEmailJobData) {
    const job = await this.emailQueue.add(JOB_SEND_EMAIL, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
    });
    return { jobId: job.id, queue: QUEUE_EMAIL };
  }

  async enqueueIngestDocument(data: IngestDocumentJobData) {
    if (!this.isEnabled()) {
      return { jobId: null, queue: QUEUE_AI, inline: true };
    }
    const job = await this.aiQueue.add(JOB_INGEST_DOCUMENT, data, {
      jobId: `ingest-${data.tenantId}-${data.documentId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    });
    return { jobId: job.id, queue: QUEUE_AI };
  }

  async enqueueAiTask(data: AiTaskJobData) {
    const tenantId = data.tenantId ?? (data.payload.tenantId as string | undefined);
    const job = await this.aiQueue.add(JOB_AI_TASK, data, {
      jobId: tenantId
        ? `ai-${data.type}-${tenantId}-${Date.now()}`
        : `ai-${data.type}-${data.userId}-${Date.now()}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 4000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    return { jobId: job.id, queue: QUEUE_AI };
  }

  async fanOutDailyWorkflow(tenantIds: string[]) {
    const jobs: Array<{ tenantId: string; jobId: string | number | undefined }> = [];
    for (const tenantId of tenantIds) {
      const { jobId } = await this.enqueueAiTask({
        type: 'daily-workflow',
        userId: 'system',
        tenantId,
        payload: { tenantId },
      });
      jobs.push({ tenantId, jobId });
    }
    return { enqueued: jobs.length, jobs };
  }

  async getJobStatus(queueName: string, jobId: string) {
    const job = await this.getJob(queueName, jobId);
    if (!job) return null;
    return this.serializeJob(queueName, job);
  }

  private static readonly JOB_LIST_TYPES = [
    'active',
    'completed',
    'delayed',
    'failed',
    'paused',
    'prioritized',
    'waiting',
    'waiting-children',
  ] as const;

  async getJobCounts(queueName: string): Promise<Record<string, number>> {
    const queue = this.queueByName(queueName);
    if (!queue) return {};

    const counts = await queue.getJobCounts(
      ...QueueDispatchService.JOB_LIST_TYPES,
    );
    const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
    return { ...counts, all: total };
  }

  async listJobs(
    queueName: string,
    state:
      | 'all'
      | 'failed'
      | 'completed'
      | 'active'
      | 'waiting'
      | 'delayed'
      | 'paused' = 'all',
    start = 0,
    end = 49,
  ) {
    const queue = this.queueByName(queueName);
    if (!queue) return [];

    const types =
      state === 'all'
        ? [...QueueDispatchService.JOB_LIST_TYPES]
        : [state];
    const jobs = await queue.getJobs(types, start, end);
    const rows = await Promise.all(
      jobs.map((job) => this.serializeJob(queueName, job)),
    );
    return rows.filter((row): row is NonNullable<typeof row> => row != null);
  }

  async retryJob(queueName: string, jobId: string) {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found in queue ${queueName}`);
    }
    await job.retry();
    return this.serializeJob(queueName, job);
  }

  async retryAllFailed(queueName: string, limit = 100) {
    const queue = this.queueByName(queueName);
    if (!queue) return { retried: 0 };

    const jobs = await queue.getJobs(['failed'], 0, limit - 1);
    let retried = 0;
    for (const job of jobs) {
      await job.retry();
      retried += 1;
    }
    return { retried };
  }

  private async getJob(queueName: string, jobId: string) {
    const queue = this.queueByName(queueName);
    if (!queue) return null;
    return queue.getJob(jobId);
  }

  private async serializeJob(queueName: string, job: Awaited<ReturnType<Queue['getJob']>>) {
    if (!job) return null;
    const state = await job.getState();
    return {
      id: job.id,
      queue: queueName,
      name: job.name,
      state,
      progress: job.progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
    };
  }

  private queueByName(name: string): Queue | null {
    switch (name) {
      case QUEUE_CONTENT_PUBLISH:
        return this.publishQueue;
      case QUEUE_COMMENTS:
        return this.commentsQueue;
      case QUEUE_WEBHOOKS:
        return this.webhooksQueue;
      case QUEUE_AI:
        return this.aiQueue;
      case QUEUE_EMAIL:
        return this.emailQueue;
      default:
        return null;
    }
  }
}
