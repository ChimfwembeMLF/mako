import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
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

@Injectable()
export class GenerateCampaignService {
  constructor(
    private readonly mistral: MistralChatService,
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

    const postCount = Math.min(14, Math.max(3, params.postCount ?? 7));
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
        'Set up Brand Brain before generating a campaign',
      );
    }

    const brandCtx = this.prompts.brandFromEntity(brand);
    const start = this.parseStartDate(params.startDate);

    const { data, tokensUsed } = await this.mistral.completeJson<CampaignPlan>(
      [
        {
          role: 'system',
          content: this.campaignSystemPrompt(postCount, platforms),
        },
        {
          role: 'user',
          content: [
            `Brand profile:\n${brandContextBlock(brandCtx)}`,
            `Campaign theme: ${theme}`,
            params.goal ? `Campaign goal: ${params.goal}` : '',
            params.name ? `Suggested name: ${params.name}` : '',
            `Target platforms: ${platforms.join(', ')}`,
            `Create exactly ${postCount} posts spread across ${postCount} days (dayOffset 0 to ${
              postCount - 1
            }).`,
            'Vary platforms across posts. Build narrative arc: tease → educate → social proof → offer → CTA.',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      { model: this.mistral.premiumModel },
    );

    await this.usage.record({
      tenantId: params.tenantId,
      userId: params.userId,
      functionName: 'generate-campaign',
      tokensUsed,
    });

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
        status: 'active',
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
          status: 'scheduled',
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
    await this.contentRepo.update(
      { campaignId: id, tenantId },
      { status: 'draft' },
    );
    await this.campaignRepo.delete(id);
    return { deleted: true };
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
