import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PageInsightsService } from '../analytics/page-insights.service';

@Injectable()
export class SyncInsightsCron {
  private readonly logger = new Logger(SyncInsightsCron.name);

  constructor(
    private readonly pageInsights: PageInsightsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncInsights(): Promise<void> {
    if (this.config.get<string>('INSIGHTS_SYNC_CRON_ENABLED') === 'false') return;

    this.logger.log('Starting daily social insights sync...');
    try {
      await this.pageInsights.syncAllInsights();
      this.logger.log('Daily social insights sync completed successfully.');
    } catch (err) {
      this.logger.error('Failed to sync social insights', err);
    }
  }
}
