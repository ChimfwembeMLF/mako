import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { LeadsModule } from '../leads/leads.module';
import { AutoReplyRulesModule } from '../auto_reply_rules/auto_reply_rules.module';
import { AiModule } from '../ai/ai.module';
import { SocialAccountsModule } from '../social_accounts/social_accounts.module';
import { WhatsappAccountAuthService } from './whatsapp-account-auth.service';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappPublishingService } from './whatsapp-publishing.service';
import { WhatsappInboundService } from './whatsapp-inbound.service';
import { WhatsappLeadService } from './whatsapp-lead.service';
import { WhatsappAutoReplyService } from './whatsapp-auto-reply.service';
import { WhatsappFlowConfig } from './entities/whatsapp_flow_config.entity';
import { WhatsappFlowSession } from './entities/whatsapp_flow_session.entity';
import { WhatsappFlowSessionService } from './whatsapp-flow-session.service';
import { WhatsappFlowEngineService } from './whatsapp-flow-engine.service';
import { ConfigurableMenuFlow } from './flows/configurable-menu.flow';
import { WhatsappFlowAiService } from './whatsapp-flow-ai.service';
import { WhatsappController } from './whatsapp.controller';

import { WhatsappBot } from './bots/whatsapp-bot.entity';
import { WhatsappBotsService } from './bots/whatsapp-bots.service';
import { WhatsappBotAgentService } from './bots/whatsapp-bot-agent.service';
import { WhatsappBotsController } from './bots/whatsapp-bots.controller';
import { BrandProfilesModule } from '../brand_profiles/brand_profiles.module';
import { KnowledgeSearchModule } from '../chatbot/knowledge-search.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappMessages,
      WhatsappContacts,
      SocialAccounts,
      Tenants,
      BrandProfiles,
      WhatsappFlowConfig,
      WhatsappFlowSession,
      WhatsappBot,
    ]),
    LeadsModule,
    AutoReplyRulesModule,
    AiModule,
    SocialAccountsModule,
    BrandProfilesModule,
    KnowledgeSearchModule,
    // Notifications → Queues → WhatsApp, so this import is a forward reference.
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    WhatsappBotsService,
    WhatsappBotAgentService,
    WhatsappAccountAuthService,
    WhatsappMessagingService,
    WhatsappPublishingService,
    WhatsappInboundService,
    WhatsappLeadService,
    WhatsappAutoReplyService,
    WhatsappFlowSessionService,
    WhatsappFlowEngineService,
    ConfigurableMenuFlow,
    WhatsappFlowAiService,
  ],
  controllers: [WhatsappBotsController, WhatsappController],
  exports: [
    WhatsappAccountAuthService,
    WhatsappMessagingService,
    WhatsappPublishingService,
    WhatsappInboundService,
  ],
})
export class WhatsappModule {}
