import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { SocialAccountsModule } from '../social_accounts/social_accounts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SocialAccountHealthCron } from './social-account-health.cron';
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
import { BackofficeModule } from '../backoffice/backoffice.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ContentItemsModule,
    ContentPublishingModule,
    PaymentsModule,
    QueuesModule,
    AnalyticsModule,
    MailModule,
    BackofficeModule,
    SocialAccountsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([SocialAccounts]),
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
    SocialAccountHealthCron,
  ],
})
export class JobsModule {}
