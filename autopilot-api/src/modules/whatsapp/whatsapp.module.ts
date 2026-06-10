import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappContacts } from '../whatsapp_contacts/entities/whatsapp_contacts.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { LeadsModule } from '../leads/leads.module';
import { AutoReplyRulesModule } from '../auto_reply_rules/auto_reply_rules.module';
import { AiModule } from '../ai/ai.module';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappPublishingService } from './whatsapp-publishing.service';
import { WhatsappInboundService } from './whatsapp-inbound.service';
import { WhatsappLeadService } from './whatsapp-lead.service';
import { WhatsappAutoReplyService } from './whatsapp-auto-reply.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappMessages,
      WhatsappContacts,
      SocialAccounts,
      Tenants,
      BrandProfiles,
    ]),
    LeadsModule,
    AutoReplyRulesModule,
    AiModule,
  ],
  providers: [
    WhatsappMessagingService,
    WhatsappPublishingService,
    WhatsappInboundService,
    WhatsappLeadService,
    WhatsappAutoReplyService,
  ],
  controllers: [WhatsappController],
  exports: [
    WhatsappMessagingService,
    WhatsappPublishingService,
    WhatsappInboundService,
  ],
})
export class WhatsappModule {}
