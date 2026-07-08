import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { SocialAccountsModule } from '../social_accounts/social_accounts.module';
import { AutoReplyRulesModule } from '../auto_reply_rules/auto_reply_rules.module';
import { AiModule } from '../ai/ai.module';
import { FacebookPublishingService } from './facebook-publishing.service';
import { InstagramPublishingService } from './instagram-publishing.service';
import { LinkedInPublishingService } from './linkedin-publishing.service';
import { TwitterPublishingService } from './twitter-publishing.service';
import { YoutubePublishingService } from './youtube-publishing.service';
import { TiktokPublishingService } from './tiktok-publishing.service';
import { FetchCommentsService } from './social-comments.service';
import { SendCommentReplyService } from './send-comment-reply.service';
import { PublicationEngagementService } from './publication-engagement.service';
import { CommentReplyAiService } from './comment-reply-ai.service';
import { SocialCommentAutoReplyService } from './social-comment-auto-reply.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { SocialPublishAccountService } from './social-publish-account.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SocialAccounts,
      ContentPublications,
      CommentReplies,
      ContentItems,
      BrandProfiles,
      Tenants,
    ]),
    SocialAccountsModule,
    AutoReplyRulesModule,
    AiModule,
    WhatsappModule,
  ],
  providers: [
    PublishMediaResolverService,
    SocialPublishAccountService,
    FacebookPublishingService,
    InstagramPublishingService,
    LinkedInPublishingService,
    TwitterPublishingService,
    YoutubePublishingService,
    TiktokPublishingService,
    CommentReplyAiService,
    SocialCommentAutoReplyService,
    FetchCommentsService,
    SendCommentReplyService,
    PublicationEngagementService,
  ],
  exports: [
    FacebookPublishingService,
    InstagramPublishingService,
    LinkedInPublishingService,
    TwitterPublishingService,
    YoutubePublishingService,
    TiktokPublishingService,
    FetchCommentsService,
    SendCommentReplyService,
    PublicationEngagementService,
    CommentReplyAiService,
    SocialCommentAutoReplyService,
    WhatsappModule,
  ],
})
export class ContentPublishingModule {}
