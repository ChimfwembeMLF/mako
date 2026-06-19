import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AutoPublishService } from '../content_items/services/auto-publish.service';
import { DailyContentWorkflowService } from '../content_items/services/daily-content-workflow.service';
import { PaymentsService } from '../payments/payments.service';
import { QueueDispatchService } from '../queues/queue-dispatch.service';
import { TenantQueueFanoutService } from '../queues/tenant-queue-fanout.service';
import { FetchCommentsService } from '../content-publishing/social-comments.service';

@Injectable()
export class CommentSyncCron {
  private readonly logger = new Logger(CommentSyncCron.name);

  constructor(
    private readonly queueDispatch: QueueDispatchService,
    private readonly fanout: TenantQueueFanoutService,
    private readonly fetchComments: FetchCommentsService,
    private readonly config: ConfigService,
  ) {}

  /** Every 10 minutes — one queue job per tenant (not one job for all tenants). */
  @Cron('0 */10 * * * *')
  async syncComments(): Promise<void> {
    if (this.config.get<string>('COMMENT_SYNC_CRON_ENABLED') === 'false')
      return;
    try {
      const tenants = await this.fanout.listTenantsForCommentSync();
      if (!tenants.length) return;

      if (this.queueDispatch.isEnabled()) {
        await this.queueDispatch.fanOutCommentSync(
          tenants.map((t) => ({
            tenantId: t.tenantId,
            userId: t.userId,
            runAutoReply: true,
          })),
        );
        return;
      }

      let fetched = 0;
      let autoReplied = 0;
      for (const t of tenants) {
        const result = await this.fetchComments.fetchForTenant({
          tenantId: t.tenantId,
          userId: t.userId,
          runAutoReply: true,
        });
        fetched += result.fetched;
        autoReplied += result.autoReplied;
      }
      if (fetched > 0 || autoReplied > 0) {
        this.logger.log(
          `Comment sync: ${fetched} new, ${autoReplied} auto-replied across ${tenants.length} tenant(s)`,
        );
      }
    } catch (err) {
      this.logger.error('Comment sync cron error', err);
    }
  }
}

@Injectable()
export class AutoPublishCron {
  private readonly logger = new Logger(AutoPublishCron.name);

  constructor(
    private readonly autoPublish: AutoPublishService,
    private readonly queueDispatch: QueueDispatchService,
    private readonly fanout: TenantQueueFanoutService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoPublish(): Promise<void> {
    if (this.config.get<string>('AUTO_PUBLISH_CRON_ENABLED') === 'false')
      return;
    try {
      const tenantIds = await this.fanout.listTenantsForAutoPublish();
      if (!tenantIds.length) return;

      if (this.queueDispatch.isEnabled()) {
        const result = await this.queueDispatch.fanOutAutoPublishTenants(
          tenantIds,
        );
        this.logger.log(
          `Auto-publish enqueued for ${result.enqueued} tenant(s)`,
        );
        return;
      }

      const result = await this.autoPublish.publishDueItems();
      if (result.attempted > 0) {
        this.logger.log(
          `Auto-publish complete: ${result.published}/${result.attempted} published, ${result.failed} failed`,
        );
      }
    } catch (err) {
      this.logger.error('Auto-publish cron error', err);
    }
  }
}

@Injectable()
export class DailyContentWorkflowCron {
  private readonly logger = new Logger(DailyContentWorkflowCron.name);

  constructor(
    private readonly dailyWorkflow: DailyContentWorkflowService,
    private readonly queueDispatch: QueueDispatchService,
    private readonly fanout: TenantQueueFanoutService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 8 * * *')
  async handleDailyWorkflow(): Promise<void> {
    if (this.config.get<string>('DAILY_WORKFLOW_CRON_ENABLED') === 'false')
      return;
    try {
      const tenantIds = await this.fanout.listTenantsForDailyWorkflow();
      if (!tenantIds.length) return;

      if (this.queueDispatch.isEnabled()) {
        const result = await this.queueDispatch.fanOutDailyWorkflow(tenantIds);
        this.logger.log(
          `Daily workflow enqueued for ${result.enqueued} tenant(s)`,
        );
        return;
      }

      let generated = 0;
      let skipped = 0;
      const errors: string[] = [];
      for (const tenantId of tenantIds) {
        const result = await this.dailyWorkflow.run({
          tenantId,
          userId: 'system',
        });
        generated += result.generated;
        skipped += result.skipped;
        errors.push(...result.errors);
      }
      this.logger.log(
        `Daily content workflow: ${generated} generated, ${skipped} skipped, ${errors.length} messages`,
      );
    } catch (err) {
      this.logger.error('Daily workflow cron error', err);
    }
  }
}

@Injectable()
export class PaymentsCron {
  private readonly logger = new Logger(PaymentsCron.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkDeposits(): Promise<void> {
    if (
      this.config.get<string>('PAYMENTS_DEV_AUTO_COMPLETE') !== 'true' &&
      this.config.get<string>('PAWAPAY_DEV_AUTO_COMPLETE') !== 'true'
    )
      return;
    const result = await this.payments.checkPendingDeposits();
    if (result.completed > 0) {
      this.logger.log(`Auto-completed ${result.completed} pending deposit(s)`);
    }
  }
}
