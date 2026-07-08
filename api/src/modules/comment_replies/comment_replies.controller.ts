import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentRepliesService } from './comment_replies.service';
import { CommentRepliesInboxService } from './comment-replies-inbox.service';
import { CommentReplies } from './entities/comment_replies.entity';
import { CommentRepliesCreateDto } from './dto/create-comment_replies.dto';
import { CommentRepliesUpdateDto } from './dto/update-comment_replies.dto';
import {
  FetchCommentsDto,
  SendCommentReplyDto,
} from './dto/comment-actions.dto';
import { FetchCommentsService } from '../content-publishing/social-comments.service';
import { SendCommentReplyService } from '../content-publishing/send-comment-reply.service';
import { CommentReplyAiService } from '../content-publishing/comment-reply-ai.service';
import { QueueDispatchService } from '../queues/queue-dispatch.service';

interface JwtUser {
  sub: string;
}

@ApiTags('Comment Replies')
@Controller('api/v1/comment-replies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommentRepliesController {
  constructor(
    private readonly service: CommentRepliesService,
    private readonly inbox: CommentRepliesInboxService,
    private readonly fetchComments: FetchCommentsService,
    private readonly sendReply: SendCommentReplyService,
    private readonly replyAi: CommentReplyAiService,
    private readonly queueDispatch: QueueDispatchService,
  ) {}

  @Post('fetch')
  fetch(@Req() req: { user: JwtUser }, @Body() dto: FetchCommentsDto) {
    const userId = String(req.user.sub);
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueSyncTenantComments({
          tenantId: dto.tenantId,
          userId,
          workspaceId: dto.workspaceId,
          runAutoReply: true,
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.fetchComments.fetchForTenant({
      tenantId: dto.tenantId,
      userId,
      workspaceId: dto.workspaceId,
      runAutoReply: true,
    });
  }

  @Post(':id/suggest')
  suggest(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAiTask({
          type: 'suggest-comment-reply',
          userId: String(req.user.sub),
          payload: { commentReplyId: id },
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.replyAi.suggestReply({
      commentReplyId: id,
      userId: String(req.user.sub),
    });
  }

  @Post(':id/send')
  send(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: SendCommentReplyDto,
  ) {
    return this.sendReply.sendReply({
      commentReplyId: id,
      userId: String(req.user.sub),
      message: dto.message,
    });
  }

  @Post()
  create(@Body() dto: CommentRepliesCreateDto): Promise<CommentReplies> {
    return this.service.create(dto);
  }

  @Get('inbox')
  getInbox(
    @Query('tenantId') tenantId: string,
    @Query('contentId') contentId?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.inbox.getInbox(tenantId, contentId, workspaceId);
  }

  @Get()
  findAll(@Query('tenantId') tenantId?: string): Promise<CommentReplies[]> {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CommentReplies> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CommentRepliesUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
