import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AllExceptionsFilter } from './filters/http-exception.filter';
import { SpaNotFoundFilter } from './filters/spa-not-found.filter';
import { typeOrmConfigFactory } from './database/ormconfig';

import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ContentCampaignsModule } from './modules/content_campaigns/content-campaigns.module';
import { ContentItemsModule } from './modules/content_items/content_items.module';
import { ContentPublicationsModule } from './modules/content_publications/content-publications.module';
import { AdsModule } from './modules/ads/ads.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MediaModule } from './modules/media/media.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { SocialAccountsModule } from './modules/social_accounts/social_accounts.module';
import { LeadsModule } from './modules/leads/leads.module';
import { PaymentFailuresModule } from './modules/payment_failures/payment_failures.module';
import { ApprovalRequestsModule } from './modules/approval_requests/approval_requests.module';
import { WhatsappContactsModule } from './modules/whatsapp_contacts/whatsapp_contacts.module';
import { WhatsappTemplatesModule } from './modules/whatsapp_templates/whatsapp-templates.module';
import { AuditLogsModule } from './modules/audit_logs/audit_logs.module';
import { AiUsageModule } from './modules/ai_usage/ai_usage.module';
import { AiModule } from './modules/ai/ai.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { RbacModule } from './modules/auth/rbac/rbac.module';
import { AutoReplyRulesModule } from './modules/auto_reply_rules/auto_reply_rules.module';
import { CommentRepliesModule } from './modules/comment_replies/comment_replies.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { LeadSourcesModule } from './modules/lead_sources/lead_sources.module';
import { BrandProfilesModule } from './modules/brand_profiles/brand_profiles.module';
import { TenantMembersModule } from './modules/tenant_members/tenant_members.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ApprovalWorkflowsModule } from './modules/approval_workflows/approval_workflows.module';
import { RolesModule } from './modules/auth/rbac/roles/roles.module';
import { PermissionsModule } from './modules/auth/rbac/permissions/permissions.module';
import { RolePermissionsModule } from './modules/auth/rbac/role_permissions/role_permissions.module';
import { UserPermissionsModule } from './modules/auth/rbac/user_permissions/user_permissions.module';
import { LegalModule } from './modules/legal/legal.module';
import { BackofficeModule } from './modules/backoffice/backoffice.module';
import { SystemSettingsModule } from './modules/system_settings/system_settings.module';
import { AuditModule } from './common/audit/audit.module';
import { PlatformsModule } from './modules/platforms/platforms.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { QueuesModule } from './modules/queues/queues.module';
import { SocialInboxModule } from './modules/social_inbox/social-inbox.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { SearchModule } from './modules/search/search.module';
import { HealthModule } from './modules/health/health.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),

    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfigFactory,
    }),

    AuthModule,
    UserModule,
    TenantsModule,
    TenantMembersModule,
    ProfilesModule,
    WorkspacesModule,
    RbacModule,
    RolesModule,
    PermissionsModule,
    RolePermissionsModule,
    UserPermissionsModule,
    BrandProfilesModule,
    ContentItemsModule,
    ContentPublicationsModule,
    ContentCampaignsModule,
    AdsModule,
    SubscriptionsModule,
    PaymentsModule,
    MediaModule,
    TemplatesModule,
    SocialAccountsModule,
    LeadsModule,
    LeadSourcesModule,
    PaymentFailuresModule,
    DepositsModule,
    ApprovalRequestsModule,
    ApprovalWorkflowsModule,
    AutoReplyRulesModule,
    WhatsappContactsModule,
    WhatsappTemplatesModule,
    CommentRepliesModule,
    AuditLogsModule,
    AiUsageModule,
    AiModule,
    JobsModule,
    LegalModule,
    BackofficeModule,
    SystemSettingsModule,
    AuditModule,
    PlatformsModule,
    WhatsappModule,
    QueuesModule,
    SocialInboxModule,
    NotificationsModule,
    ChatbotModule,
    SearchModule,
    HealthModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: SpaNotFoundFilter,
    },
  ],
})
export class AppModule {}
