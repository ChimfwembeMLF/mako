import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ContentItemsModule } from '../content_items/content_items.module';
import { ContentPublishingModule } from '../content-publishing/content-publishing.module';
import { PaymentsModule } from '../payments/payments.module';
import { QueuesModule } from '../queues/queues.module';
import {
  AutoPublishCron,
  CommentSyncCron,
  DailyContentWorkflowCron,
  PaymentsCron,
} from './content-jobs.cron';
import { SubscriptionRenewalCron } from './subscription-renewal.cron';
import { CheckPawapayDepositsCron } from './check-pawapay-deposits.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ContentItemsModule,
    ContentPublishingModule,
    PaymentsModule,
    QueuesModule,
  ],
  providers: [
    AutoPublishCron,
    CommentSyncCron,
    DailyContentWorkflowCron,
    PaymentsCron,
    SubscriptionRenewalCron,
    CheckPawapayDepositsCron,
  ],
})
export class JobsModule {}
