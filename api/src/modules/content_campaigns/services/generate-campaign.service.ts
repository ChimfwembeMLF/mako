import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiProviderRouter } from '../../ai/services/ai-provider-router.service';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { ContentItems } from '../../content_items/entities/content_items.entity';
import { ContentCampaigns } from '../entities/content_campaigns.entity';
import { brandContextBlock } from '../../ai/prompts/brand-fields';

interface PlannedPost {
  dayOffset: number;
  scheduledTime?: string;
  platform?: string;
  title: string;
  content: string;
  theme?: string;
}

interface CampaignPlan {
  name?: string;
  summary?: string;
  posts?: PlannedPost[];
}

interface CampaignOutline {
  name?: string;
  summary?: string;
  angles?: string[];
}

type CampaignBrief = {
  tenantId: string;
  theme: string;
  goal?: string;
  name?: string;
  postCount: number;
  platforms: string[];
  brandBlock: string;
};

export const MIN_CAMPAIGN_POSTS = 3;
export const MAX_CAMPAIGN_POSTS = 50;

/**
 * A response is capped at 4096 tokens, which holds roughly 14 posts. Longer
 * campaigns get an outline first, so batches written at once still tell one story.
 */
const POSTS_PER_BATCH = 10;

@Injectable()
export class GenerateCampaignService {
  constructor(
    private readonly aiRouter: AiProviderRouter,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    @InjectRepository(ContentCampaigns)
    private readonly campaignRepo: Repository<ContentCampaigns>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    private readonly brandProfiles: BrandProfilesService,
  ) {}

  async generate(params: {
    userId: string;
    tenantId: string;
    workspaceId: string;
    theme: string;
    name?: string;
    goal?: string;
    platforms?: string[];
    postCount?: number;
    startDate?: string;
  }) {
    const theme = params.theme?.trim();
    if (!theme) throw new BadRequestException('theme is required');

    const postCount = Math.min(
      MAX_CAMPAIGN_POSTS,
      Math.max(MIN_CAMPAIGN_POSTS, params.postCount ?? 7),
    );
    const platforms = params.platforms?.length
      ? params.platforms
      : ['linkedin', 'facebook', 'instagram'];

    await this.usage.assertWithinLimit(params.tenantId, params.userId);

    const brand = await this.brandProfiles.resolveForContext({
      tenantId: params.tenantId,
      userId: params.userId,
      workspaceId: params.workspaceId,
    });
    if (!brand?.id) {
      throw new BadRequestException(
        'Set up Brand voice before generating a campaign',
      );
    }

    const brandCtx = this.prompts.brandFromEntity(brand);
    const start = this.parseStartDate(params.startDate);

    const brief: CampaignBrief = {
      tenantId: params.tenantId,
      theme,
      goal: params.goal,
      name: params.name,
      postCount,
      platforms,
      brandBlock: brandContextBlock(brandCtx),
    };

    // Recorded once: ai_usage is unique per tenant and timestamp, so parallel writes can collide.
    const spend = { tokens: 0 };
    let data: CampaignPlan;
    try {
      data =
        postCount > POSTS_PER_BATCH
          ? await this.planInBatches(brief, spend)
          : await this.planInOneRequest(brief, spend);
    } finally {
      if (spend.tokens > 0) {
        await this.usage.record({
          tenantId: params.tenantId,
          userId: params.userId,
          functionName: 'generate-campaign',
          tokensUsed: spend.tokens,
        });
      }
    }
    const tokensUsed = spend.tokens;

    const posts = this.normalizePosts(data.posts, postCount, platforms, theme);
    if (!posts.length) {
      throw new BadRequestException(
        'AI did not return campaign posts — try again',
      );
    }

    const campaign = await this.campaignRepo.save(
      this.campaignRepo.create({
        tenantId: params.tenantId,
        workspaceId: params.workspaceId,
        userId: params.userId,
        name: (params.name || data.name || theme).slice(0, 200),
        goal: params.goal,
        theme,
        platforms,
        postCount: posts.length,
        startDate: start,
        status: 'review',
        summary: data.summary?.trim(),
      }),
    );

    const savedItems: ContentItems[] = [];
    for (const post of posts) {
      const scheduledDate = new Date(start);
      scheduledDate.setDate(scheduledDate.getDate() + post.dayOffset);

      const item = await this.contentRepo.save(
        this.contentRepo.create({
          tenantId: params.tenantId,
          workspaceId: params.workspaceId,
          userId: params.userId,
          brandProfileId: brand.id,
          campaignId: campaign.id,
          contentType: 'content',
          title: post.title,
          content: post.content,
          campaignTheme: post.theme || theme,
          // Dated but not queued: auto-publish only picks up scheduled or approved posts.
          status: 'draft',
          platforms: post.platform ? [post.platform] : platforms.slice(0, 1),
          scheduledDate,
          scheduledTime: post.scheduledTime || '09:00',
        }),
      );
      savedItems.push(item);
    }

    return {
      campaign,
      posts: savedItems,
      tokensUsed,
    };
  }

  async findByTenant(
    tenantId: string,
    workspaceId?: string,
  ): Promise<ContentCampaigns[]> {
    const where: { tenantId: string; workspaceId?: string } = { tenantId };
    if (workspaceId) where.workspaceId = workspaceId;
    return this.campaignRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id, tenantId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const posts = await this.contentRepo.find({
      where: { campaignId: id, tenantId },
      order: { scheduledDate: 'ASC', created_at: 'ASC' },
    });
    return { campaign, posts };
  }

  async remove(id: string, tenantId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id, tenantId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    // Published posts keep their status: this only cancels what hasn't gone out yet.
    await this.contentRepo.update(
      { campaignId: id, tenantId, status: In(['scheduled', 'approved']) },
      { status: 'draft' },
    );
    await this.campaignRepo.delete(id);
    return { deleted: true };
  }

  /** Queues a reviewed campaign for publishing. */
  async approve(id: string, tenantId: string, today = new Date()) {
    const campaign = await this.campaignRepo.findOne({
      where: { id, tenantId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const drafts = await this.contentRepo.find({
      where: { campaignId: id, tenantId, status: 'draft' },
    });
    if (!drafts.length) {
      throw new BadRequestException('This campaign has no drafts to approve');
    }

    const shiftDays = this.daysOverdue(drafts, today);
    for (const post of drafts) {
      post.status = 'scheduled';
      if (post.scheduledDate && shiftDays > 0) {
        const moved = new Date(post.scheduledDate);
        moved.setDate(moved.getDate() + shiftDays);
        post.scheduledDate = moved;
      }
    }
    await this.contentRepo.save(drafts);

    campaign.status = 'active';
    await this.campaignRepo.save(campaign);
    return { approved: drafts.length, shiftedDays: shiftDays };
  }

  /** How far to move the series so a late approval doesn't publish a backlog at once. */
  private daysOverdue(posts: ContentItems[], today: Date): number {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const earliest = Math.min(
      ...posts
        .filter((post) => post.scheduledDate)
        .map((post) => new Date(post.scheduledDate as Date).getTime()),
    );
    if (!Number.isFinite(earliest) || earliest >= start.getTime()) return 0;
    return Math.ceil((start.getTime() - earliest) / (24 * 60 * 60 * 1000));
  }

  private briefLines({ brandBlock, theme, goal, name, platforms }: CampaignBrief) {
    return [
      `Brand profile:\n${brandBlock}`,
      `Campaign theme: ${theme}`,
      goal ? `Campaign goal: ${goal}` : '',
      name ? `Suggested name: ${name}` : '',
      `Target platforms: ${platforms.join(', ')}`,
    ].filter(Boolean);
  }

  private async askAi<T>(
    brief: CampaignBrief,
    spend: { tokens: number },
    system: string,
    user: string[],
  ): Promise<T> {
    const { data, tokensUsed } = await this.aiRouter.completeJson<T>(
      [
        { role: 'system', content: system },
        { role: 'user', content: user.join('\n\n') },
      ],
      { model: this.aiRouter.premiumModel, tenantId: brief.tenantId },
    );
    spend.tokens += tokensUsed;
    return data;
  }

  private planInOneRequest(
    brief: CampaignBrief,
    spend: { tokens: number },
  ): Promise<CampaignPlan> {
    const { postCount, platforms } = brief;
    return this.askAi<CampaignPlan>(
      brief,
      spend,
      this.campaignSystemPrompt(postCount, platforms),
      [
        ...this.briefLines(brief),
        `Create exactly ${postCount} posts spread across ${postCount} days (dayOffset 0 to ${
          postCount - 1
        }).`,
        'Vary platforms across posts. Build narrative arc: tease → educate → social proof → offer.',
      ],
    );
  }

  private async planInBatches(
    brief: CampaignBrief,
    spend: { tokens: number },
  ): Promise<CampaignPlan> {
    const { postCount } = brief;
    const outline = await this.askAi<CampaignOutline>(
      brief,
      spend,
      `You are a senior social media strategist. Outline a ${postCount}-post content campaign.
Return ONLY valid JSON:
{ "name": "Campaign title", "summary": "2-3 sentence strategy overview", "angles": ["One line describing post 1", "..."] }
Rules:
- Exactly ${postCount} angles, one for each post, in publishing order.
- Each angle must be different and advance the campaign narrative.
- Build narrative arc: tease → educate → social proof → offer.`,
      this.briefLines(brief),
    );

    const angles = outline.angles ?? [];
    if (angles.length < postCount) {
      throw new BadRequestException('AI did not return a campaign plan — try again');
    }

    const starts = Array.from(
      { length: Math.ceil(postCount / POSTS_PER_BATCH) },
      (_, batch) => batch * POSTS_PER_BATCH,
    );
    const batches = await Promise.all(
      starts.map(async (first) => {
        const batchAngles = angles.slice(first, first + POSTS_PER_BATCH);
        try {
          return await this.writeBatch(brief, spend, batchAngles, first);
        } catch {
          // One provider hiccup shouldn't cost the user the whole campaign.
          return this.writeBatch(brief, spend, batchAngles, first);
        }
      }),
    );

    return { ...outline, posts: batches.flat() };
  }

  private async writeBatch(
    brief: CampaignBrief,
    spend: { tokens: number },
    angles: string[],
    first: number,
  ): Promise<PlannedPost[]> {
    const { posts } = await this.askAi<CampaignPlan>(
      brief,
      spend,
      this.campaignSystemPrompt(angles.length, brief.platforms),
      [
        ...this.briefLines(brief),
        `This is part of a ${brief.postCount}-post campaign. Write posts ${first + 1} to ${
          first + angles.length
        }, one for each of these angles, in order:`,
        angles.map((angle, i) => `${i + 1}. ${angle}`).join('\n'),
      ],
    );
    const written = this.normalizePosts(posts, angles.length, brief.platforms, brief.theme);
    if (written.length < angles.length) {
      throw new BadRequestException('AI did not return campaign posts — try again');
    }
    // The AI numbers each batch from zero; the calendar needs one post per day overall.
    return written.map((post, i) => ({ ...post, dayOffset: first + i }));
  }

  private campaignSystemPrompt(postCount: number, platforms: string[]): string {
    return `You are a senior social media strategist. Plan a ${postCount}-post content campaign.
Return ONLY valid JSON:
{
  "name": "Campaign title",
  "summary": "2-3 sentence strategy overview",
  "posts": [
    {
      "dayOffset": 0,
      "scheduledTime": "09:00",
      "platform": "linkedin",
      "title": "Post headline",
      "content": "<p>HTML body with <strong>emphasis</strong></p>",
      "theme": "Specific angle for this post"
    }
  ]
}
Rules:
- Exactly ${postCount} posts in the posts array.
- dayOffset from 0 to ${postCount - 1} (one post per day).
- platform must be one of: ${platforms.join(', ')}.
- Rotate platforms; don't use the same platform more than twice in a row.
- content uses simple HTML: <p>, <ul>, <li>, <strong> — no scripts.
- Each post must be unique and advance the campaign narrative.`;
  }

  private normalizePosts(
    raw: PlannedPost[] | undefined,
    expected: number,
    platforms: string[],
    fallbackTheme: string,
  ): PlannedPost[] {
    if (!Array.isArray(raw)) return [];

    return raw.slice(0, expected).map((p, i) => ({
      dayOffset: typeof p.dayOffset === 'number' ? p.dayOffset : i,
      scheduledTime: p.scheduledTime || '09:00',
      platform: platforms.includes(p.platform ?? '')
        ? p.platform!
        : platforms[i % platforms.length],
      title: String(p.title ?? `Post ${i + 1}`).slice(0, 200),
      content: String(p.content ?? `<p>${fallbackTheme}</p>`),
      theme: String(p.theme ?? fallbackTheme),
    }));
  }

  private parseStartDate(value?: string): Date {
    if (value) {
      const d = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}
