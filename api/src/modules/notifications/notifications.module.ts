import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notifications } from './entities/notifications.entity';
import { NotificationPreferences } from './entities/notification_preferences.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationCron } from './notification.cron';
import { UserEntity } from '../user/user.entity';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { Leads } from '../leads/entities/leads.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { AiUsage } from '../ai_usage/entities/ai_usage.entity';
import { Deposits } from '../deposits/entities/deposits.entity';
import { ChatSession } from '../chatbot/entities/chat-session.entity';
import { ChatMessage } from '../chatbot/entities/chat-message.entity';
import { KnowledgeDocument } from '../chatbot/entities/knowledge-document.entity';
import { ChatbotConfig } from '../chatbot/entities/chatbot-config.entity';
import { ChatbotApiKey } from '../chatbot/entities/chatbot-api-key.entity';
import { MailModule } from '../mail/mail.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notifications,
      NotificationPreferences,
      UserEntity,
      TenantMembers,
      TenantSubscriptions,
      ContentPublications,
      CommentReplies,
      Leads,
      ContentItems,
      AiUsage,
      Deposits,
      ChatSession,
      ChatMessage,
      KnowledgeDocument,
      ChatbotConfig,
      ChatbotApiKey,
    ]),
    MailModule,
    forwardRef(() => QueuesModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
