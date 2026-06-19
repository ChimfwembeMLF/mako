import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentReplies } from './entities/comment_replies.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { CommentRepliesService } from './comment_replies.service';
import { CommentRepliesInboxService } from './comment-replies-inbox.service';
import { CommentRepliesController } from './comment_replies.controller';
import { ContentPublishingModule } from '../content-publishing/content-publishing.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommentReplies,
      ContentItems,
      ContentPublications,
      SocialAccounts,
    ]),
    ContentPublishingModule,
    forwardRef(() => QueuesModule),
  ],
  providers: [CommentRepliesService, CommentRepliesInboxService],
  controllers: [CommentRepliesController],
  exports: [CommentRepliesService, CommentRepliesInboxService],
})
export class CommentRepliesModule {}
