import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_CONTENT_PUBLISH,
  JOB_PUBLISH_CONTENT,
  JOB_AUTO_PUBLISH_SCAN,
  JOB_AUTO_PUBLISH_TENANT,
  QUEUE_JOB_MAX_ATTEMPTS,
  AutoPublishTenantJobData,
  PublishContentJobData,
} from '../queue.constants';
import { PublishContentService } from '../../content_items/services/publish-content.service';
import { AutoPublishService } from '../../content_items/services/auto-publish.service';

@Processor(QUEUE_CONTENT_PUBLISH)
export class ContentPublishProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentPublishProcessor.name);

  constructor(
    private readonly publishContent: PublishContentService,
    private readonly autoPublish: AutoPublishService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOB_PUBLISH_CONTENT:
        return this.handlePublish(job as Job<PublishContentJobData>);
      case JOB_AUTO_PUBLISH_SCAN:
        return this.handleAutoPublishScan();
      case JOB_AUTO_PUBLISH_TENANT:
        return this.handleAutoPublishTenant(job as Job<AutoPublishTenantJobData>);
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
        return null;
    }
  }

  private async handlePublish(job: Job<PublishContentJobData>) {
    const data = job.data;
    this.logger.log(`Publishing content ${data.contentId} (job ${job.id})`);
    const result = await this.publishContent.publish({
      contentId: data.contentId,
      userId: data.userId,
      platforms: data.platforms,
      platformPayloads: data.platformPayloads,
    });

    if (!result.published) {
      const reasons = Object.entries(result.results ?? {})
        .map(([p, r]) => `${p}: ${r.message}`)
        .join('; ');
      const attempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? QUEUE_JOB_MAX_ATTEMPTS;
      if (attempt >= maxAttempts) {
        this.logger.error(
          `Publish failed for ${data.contentId} after ${attempt} attempt(s): ${reasons}`,
        );
      }
      throw new Error(reasons || 'Publish failed on all platforms');
    }

    return result;
  }

  private async handleAutoPublishScan() {
    this.logger.log('Running auto-publish scan (legacy — fans out per content)');
    return this.autoPublish.queueDueItems();
  }

  private async handleAutoPublishTenant(job: Job<AutoPublishTenantJobData>) {
    const { tenantId } = job.data;
    this.logger.log(`Auto-publish scan for tenant ${tenantId} (job ${job.id})`);
    return this.autoPublish.queueDueItemsForTenant(tenantId);
  }
}
