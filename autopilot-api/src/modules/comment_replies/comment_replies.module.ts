import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentReplies } from './entities/comment_replies.entity';
import { CommentRepliesService } from './comment_replies.service';
import { CommentRepliesController } from './comment_replies.controller';
import { ContentPublishingModule } from '../content-publishing/content-publishing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommentReplies]),
    ContentPublishingModule,
  ],
  providers: [CommentRepliesService],
  controllers: [CommentRepliesController],
  exports: [CommentRepliesService],
})
export class CommentRepliesModule {}
