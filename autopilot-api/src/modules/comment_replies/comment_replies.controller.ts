import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentRepliesService } from './comment_replies.service';
import { CommentReplies } from './entities/comment_replies.entity';
import { CommentRepliesCreateDto } from './dto/create-comment_replies.dto';
import { CommentRepliesUpdateDto } from './dto/update-comment_replies.dto';
import { FetchCommentsDto, SendCommentReplyDto } from './dto/comment-actions.dto';
import { FetchCommentsService, SendCommentReplyService } from '../content-publishing/social-comments.service';

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
    private readonly fetchComments: FetchCommentsService,
    private readonly sendReply: SendCommentReplyService,
  ) {}

  @Post('fetch')
  fetch(@Req() req: { user: JwtUser }, @Body() dto: FetchCommentsDto) {
    return this.fetchComments.fetchForTenant({
      tenantId: dto.tenantId,
      userId: String(req.user.sub),
    });
  }

  @Post(':id/send')
  send(@Req() req: { user: JwtUser }, @Param('id') id: string, @Body() dto: SendCommentReplyDto) {
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

  @Get()
  findAll(): Promise<CommentReplies[]> {
    return this.service.findAll();
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
