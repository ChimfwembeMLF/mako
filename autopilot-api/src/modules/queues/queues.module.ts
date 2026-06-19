import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_QUEUES } from './queue.constants';
import { createBullBoardAuthMiddleware } from './bull-board-auth.middleware';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { UserEntity } from '../user/user.entity';
import { Profiles } from '../profiles/entities/profiles.entity';
import { QueueDispatchService } from './queue-dispatch.service';
import { QueueJobsController } from './queue-jobs.controller';
import { ContentPublishProcessor } from './processors/content-publish.processor';
import { CommentsProcessor } from './processors/comments.processor';
import { WebhooksProcessor } from './processors/webhooks.processor';
import { EmailProcessor } from './processors/email.processor';
import { AiProcessor } from './processors/ai.processor';
import { ContentItemsModule } from '../content_items/content_items.module';
import { ContentPublishingModule } from '../content-publishing/content-publishing.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadSourcesModule } from '../lead_sources/lead_sources.module';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantQueueFanoutService } from './tenant-queue-fanout.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      Profiles,
      ContentPublications,
      ContentItems,
    ]),
    SubscriptionsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(config.get<string>('REDIS_PORT') ?? 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullBoardModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        route: '/admin/queues',
        adapter: ExpressAdapter,
        middleware: createBullBoardAuthMiddleware(
          config.get<string>('BULL_BOARD_USER') ?? 'admin',
          config.get<string>('BULL_BOARD_PASSWORD'),
        ),
      }),
    }),
    BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
    BullBoardModule.forFeature(
      ...ALL_QUEUES.map((name) => ({
        name,
        adapter: BullMQAdapter,
      })),
    ),
    forwardRef(() => ContentItemsModule),
    forwardRef(() => ContentPublishingModule),
    forwardRef(() => ChatbotModule),
    forwardRef(() => WhatsappModule),
    forwardRef(() => LeadsModule),
    LeadSourcesModule,
  ],
  controllers: [QueueJobsController],
  providers: [
    QueueDispatchService,
    TenantQueueFanoutService,
    SuperAdminGuard,
    ContentPublishProcessor,
    CommentsProcessor,
    WebhooksProcessor,
    EmailProcessor,
    AiProcessor,
  ],
  exports: [QueueDispatchService, TenantQueueFanoutService, BullModule],
})
export class QueuesModule {}
