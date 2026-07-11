import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackofficeService } from './backoffice.service';
import { BackofficeController } from './backoffice.controller';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Tenants } from '../tenants/entities/tenants.entity';
import { UserEntity } from '../user/user.entity';
import { Profiles } from '../profiles/entities/profiles.entity';
import { Deposits } from '../deposits/entities/deposits.entity';
import { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';
import { AiUsage } from '../ai_usage/entities/ai_usage.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';

import { Leads } from '../leads/entities/leads.entity';
import { AuditLogs } from '../audit_logs/entities/audit_logs.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { DataDeletionRequests } from '../legal/entities/data_deletion_requests.entity';
import { ChatbotConfig } from '../chatbot/entities/chatbot-config.entity';
import { ChatSession } from '../chatbot/entities/chat-session.entity';
import { ChatMessage } from '../chatbot/entities/chat-message.entity';
import { KnowledgeDocument } from '../chatbot/entities/knowledge-document.entity';
import { KnowledgeChunk } from '../chatbot/entities/knowledge-chunk.entity';
import { ChatbotApiKey } from '../chatbot/entities/chatbot-api-key.entity';
import { RefundRequests } from '../payments/entities/refund_requests.entity';

import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    SubscriptionsModule,
    PaymentsModule,
    TypeOrmModule.forFeature([
      Tenants,
      UserEntity,
      Profiles,
      Deposits,
      TenantSubscriptions,
      AiUsage,
      ContentItems,
      ContentPublications,
      TenantMembers,
      SocialAccounts,
      Leads,
      AuditLogs,
      CommentReplies,
      DataDeletionRequests,
      ChatbotConfig,
      ChatSession,
      ChatMessage,
      KnowledgeDocument,
      KnowledgeChunk,
      ChatbotApiKey,
      RefundRequests,
    ]),
  ],
  providers: [BackofficeService, SuperAdminGuard],
  controllers: [BackofficeController],
})
export class BackofficeModule {}
