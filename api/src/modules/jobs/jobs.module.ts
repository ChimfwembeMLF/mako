import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ContentItemsModule } from '../content_items/content_items.module';
import { ContentPublishingModule } from '../content-publishing/content-publishing.module';
import { PaymentsModule } from '../payments/payments.module';
import { QueuesModule } from '../queues/queues.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MailModule } from '../mail/mail.module';
import {
  AutoPublishCron,
  CommentSyncCron,
  DailyContentWorkflowCron,
  PaymentsCron,
} from './content-jobs.cron';
import { SubscriptionRenewalCron } from './subscription-renewal.cron';
import { CheckPawapayDepositsCron } from './check-pawapay-deposits.cron';
import { SyncInsightsCron } from './sync-insights.cron';
import { SyncGmailInboxCron } from './sync-gmail-inbox.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ContentItemsModule,
    ContentPublishingModule,
    PaymentsModule,
    QueuesModule,
    AnalyticsModule,
    MailModule,
  ],
  providers: [
    AutoPublishCron,
    CommentSyncCron,
    DailyContentWorkflowCron,
    PaymentsCron,
    SubscriptionRenewalCron,
    CheckPawapayDepositsCron,
    SyncInsightsCron,
    SyncGmailInboxCron,
  ],
})
export class JobsModule {}
