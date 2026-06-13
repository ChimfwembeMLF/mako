import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItems } from '../entities/content_items.entity';
import { PublishContentService, MAX_CONTENT_PUBLISH_ATTEMPTS } from './publish-content.service';
import { isContentDue } from '../utils/schedule.util';
import { QueueDispatchService } from '../../queues/queue-dispatch.service';

@Injectable()
export class AutoPublishService {
  private readonly logger = new Logger(AutoPublishService.name);

  constructor(
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    private readonly publishContent: PublishContentService,
    @Optional() private readonly queueDispatch?: QueueDispatchService,
  ) {}

  /** Enqueue publish jobs for due approved content in one tenant. */
  async queueDueItemsForTenant(tenantId: string): Promise<{
    queued: number;
    jobs: Array<{ jobId: string | number | undefined; queue: string; contentId: string }>;
  }> {
    const due = (await this.findDueItems()).filter((item) => item.tenantId === tenantId);
    const jobs: Array<{ jobId: string | number | undefined; queue: string; contentId: string }> = [];

    for (const item of due) {
      if (!this.queueDispatch?.isEnabled()) {
        await this.publishContent.publish({
          contentId: item.id,
          userId: item.userId,
          platforms: item.platforms,
        });
        jobs.push({ jobId: undefined, queue: 'sync', contentId: item.id });
        continue;
      }

      const { jobId, queue } = await this.queueDispatch.enqueuePublish({
        tenantId: item.tenantId,
        contentId: item.id,
        userId: item.userId,
        platforms: item.platforms,
      });
      jobs.push({ jobId, queue, contentId: item.id });
      this.logger.log(`Queued auto-publish for ${item.id} (tenant ${tenantId}) → job ${jobId}`);
    }

    return { queued: jobs.length, jobs };
  }

  /** Enqueue publish jobs for all due approved content (used by queue worker). */
  async queueDueItems(): Promise<{
    queued: number;
    jobs: Array<{ jobId: string | number | undefined; queue: string; contentId: string }>;
  }> {
    const due = await this.findDueItems();
    const jobs: Array<{ jobId: string | number | undefined; queue: string; contentId: string }> = [];

    for (const item of due) {
      if (!this.queueDispatch?.isEnabled()) {
        await this.publishContent.publish({
          contentId: item.id,
          userId: item.userId,
          platforms: item.platforms,
        });
        jobs.push({ jobId: undefined, queue: 'sync', contentId: item.id });
        continue;
      }

      const { jobId, queue } = await this.queueDispatch.enqueuePublish({
        tenantId: item.tenantId,
        contentId: item.id,
        userId: item.userId,
        platforms: item.platforms,
      });
      jobs.push({ jobId, queue, contentId: item.id });
      this.logger.log(`Queued auto-publish for ${item.id} → job ${jobId}`);
    }

    return { queued: jobs.length, jobs };
  }

  async publishDueItems(): Promise<{
    attempted: number;
    published: number;
    failed: number;
    errors: string[];
    queued?: number;
  }> {
    if (this.queueDispatch?.isEnabled()) {
      const result = await this.queueDueItems();
      return {
        attempted: result.queued,
        published: 0,
        failed: 0,
        errors: [],
        queued: result.queued,
      };
    }

    const due = await this.findDueItems();
    let published = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of due) {
      try {
        const result = await this.publishContent.publish({
          contentId: item.id,
          userId: item.userId,
          platforms: item.platforms,
        });
        if (result.published) {
          published++;
          this.logger.log(`Published content ${item.id}`);
        } else {
          failed++;
          const msg = Object.values(result.results ?? {})
            .map((r) => r.message)
            .join('; ');
          errors.push(`${item.id}: ${msg || 'publish failed'}`);
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${item.id}: ${msg}`);
        this.logger.warn(`Auto-publish failed for ${item.id}: ${msg}`);
      }
    }

    return { attempted: due.length, published, failed, errors };
  }

  private async findDueItems(): Promise<ContentItems[]> {
    const items = await this.contentRepo.find({
      where: [{ status: 'approved' }, { status: 'scheduled' }],
    });
    return items.filter(
      (item) =>
        isContentDue(item) &&
        (item.publishAttempts ?? 0) < MAX_CONTENT_PUBLISH_ATTEMPTS,
    );
  }
}
