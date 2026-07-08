import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialMessages } from './entities/social_messages.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappMessages } from '../whatsapp/entities/whatsapp_messages.entity';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { CommentRepliesModule } from '../comment_replies/comment_replies.module';
import { AutoReplyRulesModule } from '../auto_reply_rules/auto_reply_rules.module';
import { AiModule } from '../ai/ai.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { UnifiedInboxService } from './unified-inbox.service';
import { SocialMessagingSyncService } from './social-messaging-sync.service';
import { SocialMessagingInboundService } from './social-messaging-inbound.service';
import { SocialDmAutoReplyService } from './social-dm-auto-reply.service';
import { SocialDmReplyService } from './social-dm-reply.service';
import { SocialInboxController } from './social-inbox.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SocialMessages,
      SocialAccounts,
      WhatsappMessages,
      BrandProfiles,
      Tenants,
    ]),
    CommentRepliesModule,
    AutoReplyRulesModule,
    AiModule,
    WhatsappModule,
  ],
  controllers: [SocialInboxController],
  providers: [
    UnifiedInboxService,
    SocialMessagingSyncService,
    SocialMessagingInboundService,
    SocialDmAutoReplyService,
    SocialDmReplyService,
  ],
  exports: [
    UnifiedInboxService,
    SocialMessagingInboundService,
    SocialMessagingSyncService,
  ],
})
export class SocialInboxModule {}
