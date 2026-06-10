import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { SocialAccountsModule } from '../social_accounts/social_accounts.module';
import { FacebookPublishingService } from './facebook-publishing.service';
import { InstagramPublishingService } from './instagram-publishing.service';
import { LinkedInPublishingService } from './linkedin-publishing.service';
import { TwitterPublishingService } from './twitter-publishing.service';
import { FetchCommentsService, SendCommentReplyService } from './social-comments.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { SocialPublishAccountService } from './social-publish-account.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialAccounts, ContentPublications, CommentReplies]),
    SocialAccountsModule,
    WhatsappModule,
  ],
  providers: [
    PublishMediaResolverService,
    SocialPublishAccountService,
    FacebookPublishingService,
    InstagramPublishingService,
    LinkedInPublishingService,
    TwitterPublishingService,
    FetchCommentsService,
    SendCommentReplyService,
  ],
  exports: [
    FacebookPublishingService,
    InstagramPublishingService,
    LinkedInPublishingService,
    TwitterPublishingService,
    FetchCommentsService,
    SendCommentReplyService,
    WhatsappModule,
  ],
})
export class ContentPublishingModule {}
