import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { AutoReplyRulesService } from '../auto_reply_rules/auto_reply_rules.service';
import { CommentReplyAiService } from './comment-reply-ai.service';
import { SendCommentReplyService } from './send-comment-reply.service';

@Injectable()
export class SocialCommentAutoReplyService {
  private readonly logger = new Logger(SocialCommentAutoReplyService.name);

  constructor(
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    private readonly rules: AutoReplyRulesService,
    private readonly replyAi: CommentReplyAiService,
    private readonly sendReply: SendCommentReplyService,
  ) {}

  /** Evaluate auto-reply rules for newly synced comments. */
  async processNewComments(
    commentIds: string[],
    userId: string,
  ): Promise<{ sent: number; skipped: number }> {
    if (!commentIds.length) return { sent: 0, skipped: 0 };

    const comments = await this.commentsRepo.find({
      where: { id: In(commentIds), status: 'pending' },
    });

    let sent = 0;
    let skipped = 0;

    for (const comment of comments) {
      const ok = await this.tryAutoReply(comment, userId);
      if (ok) sent++;
      else skipped++;
    }

    return { sent, skipped };
  }

  /** Process pending comments for a tenant, optionally limited to one workspace. */
  async processPendingForTenant(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<{ sent: number; skipped: number }> {
    let pending = await this.commentsRepo.find({
      where: { tenantId, status: 'pending' },
      order: { created_at: 'ASC' },
      take: 50,
    });

    if (workspaceId) {
      const contentIds = (
        await this.contentRepo.find({
          where: { tenantId, workspaceId },
          select: ['id'],
        })
      ).map((c) => c.id);
      if (!contentIds.length) return { sent: 0, skipped: 0 };
      pending = pending.filter((c) => contentIds.includes(c.contentId));
    }

    let sent = 0;
    let skipped = 0;
    for (const comment of pending) {
      const ok = await this.tryAutoReply(comment, userId);
      if (ok) sent++;
      else skipped++;
    }
    return { sent, skipped };
  }

  private async tryAutoReply(
    comment: CommentReplies,
    userId: string,
  ): Promise<boolean> {
    // Never auto-reply to our own comments (including threaded brand replies)
    if (comment.isFromBrand) return false;
    if (comment.status !== 'pending') return false;
    if (comment.replyText?.trim()) return false;

    const workspaceId = await this.resolveWorkspaceId(comment);
    const activeRules = await this.rules.findActiveForPlatform(
      comment.tenantId,
      comment.platform,
      workspaceId,
    );
    if (!activeRules.length) {
      return false;
    }
    const rule = this.rules.matchKeywordRule(activeRules, comment.commentText);
    if (!rule) {
      return false;
    }

    try {
      const replyText = await this.replyAi.buildReplyText(
        comment,
        rule,
        userId,
      );
      if (!replyText.trim()) return false;

      await this.sendReply.sendReply({
        commentReplyId: comment.id,
        userId,
        message: replyText.trim(),
        replyType: 'auto_reply',
        ruleId: rule.id,
      });

      this.logger.log(
        `Auto-reply sent on ${comment.platform} for comment ${comment.id} (rule: ${rule.name})`,
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Auto-reply failed for ${comment.platform} comment ${comment.id}: ${msg}`,
      );
      return false;
    }
  }

  private async resolveWorkspaceId(
    comment: CommentReplies,
  ): Promise<string | undefined> {
    const content = await this.contentRepo.findOne({
      where: { id: comment.contentId },
      select: ['id', 'workspaceId'],
    });
    return content?.workspaceId;
  }
}
