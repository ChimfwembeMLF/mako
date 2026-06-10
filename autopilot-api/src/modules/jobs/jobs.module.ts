import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ContentItemsModule } from '../content_items/content_items.module';
import { ContentPublishingModule } from '../content-publishing/content-publishing.module';
import { PaymentsModule } from '../payments/payments.module';
import {
  AutoPublishCron,
  CommentSyncCron,
  DailyContentWorkflowCron,
  PaymentsCron,
} from './content-jobs.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ContentItemsModule,
    ContentPublishingModule,
    PaymentsModule,
  ],
  providers: [AutoPublishCron, CommentSyncCron, DailyContentWorkflowCron, PaymentsCron],
})
export class JobsModule {}
