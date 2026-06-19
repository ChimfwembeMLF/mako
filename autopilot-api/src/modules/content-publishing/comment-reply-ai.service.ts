import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../ai/services/prompt-builder.service';
import { AiUsageTrackerService } from '../ai/services/ai-usage-tracker.service';

export type CommentReplyContext = {
  postTitle?: string;
  postContent: string;
  commenterName: string;
  commentText: string;
  platform: string;
};

@Injectable()
export class CommentReplyAiService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
  ) {}

  async suggestReply(params: {
    commentReplyId: string;
    userId: string;
  }): Promise<{ content: string }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: params.commentReplyId },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    await this.usage.assertWithinLimit(comment.tenantId, params.userId);

    const content = await this.generateAiReply(comment, params.userId);
    return { content };
  }

  async buildReplyText(
    comment: CommentReplies,
    rule: { responseTemplate?: string; aiGenerate: boolean },
    userId: string,
  ): Promise<string> {
    if (rule.aiGenerate) {
      return this.generateAiReply(comment, userId);
    }

    const ctx = await this.loadContext(comment);
    const template = rule.responseTemplate?.trim();
    if (!template) return '';

    return template
      .replace(/\{message\}/gi, ctx.commentText)
      .replace(/\{customer_message\}/gi, ctx.commentText)
      .replace(/\{customer_name\}/gi, ctx.commenterName)
      .replace(/\{post_title\}/gi, ctx.postTitle ?? '')
      .replace(
        /\{post_content\}/gi,
        ctx.postContent.replace(/<[^>]*>/g, '').trim(),
      );
  }

  private async generateAiReply(
    comment: CommentReplies,
    userId: string,
  ): Promise<string> {
    const ctx = await this.loadContext(comment);
    const brandCtx = await this.loadBrand(comment);

    const { data, tokensUsed } = await this.mistral.completeJson<{
      content?: string;
    }>(
      [
        {
          role: 'system',
          content: this.prompts.commentReplySystem(brandCtx, ctx.platform),
        },
        {
          role: 'user',
          content: this.prompts.commentReplyUser(ctx),
        },
      ],
      { model: this.mistral.defaultModel },
    );

    await this.usage.record({
      tenantId: comment.tenantId,
      userId,
      functionName: 'comment-reply-suggest',
      tokensUsed,
    });

    return data.content?.trim() ?? '';
  }

  private async loadContext(
    comment: CommentReplies,
  ): Promise<CommentReplyContext> {
    const item = await this.contentRepo.findOne({
      where: { id: comment.contentId },
    });
    const publication = await this.publicationsRepo.findOne({
      where: {
        contentId: comment.contentId,
        platform: comment.platform,
        status: 'published',
      },
      order: { publishedAt: 'DESC' },
    });

    const postContent = publication?.publishedContent ?? item?.content ?? '';
    const postTitle = publication?.publishedTitle ?? item?.title;

    return {
      platform: comment.platform,
      postTitle,
      postContent,
      commenterName: comment.commenterName,
      commentText: comment.commentText,
    };
  }

  private async loadBrand(comment: CommentReplies) {
    const item = await this.contentRepo.findOne({
      where: { id: comment.contentId },
    });
    const tenant = await this.tenantsRepo.findOne({
      where: { id: comment.tenantId },
    });
    if (!tenant) return this.prompts.brandFromEntity(null);

    const brand = item?.workspaceId
      ? await this.brandRepo.findOne({
          where: { tenantId: comment.tenantId, workspaceId: item.workspaceId },
        })
      : await this.brandRepo.findOne({
          where: {
            tenantId: comment.tenantId,
            userId: tenant.ownerId,
            workspaceId: IsNull(),
          },
        });
    return this.prompts.brandFromEntity(brand);
  }
}
