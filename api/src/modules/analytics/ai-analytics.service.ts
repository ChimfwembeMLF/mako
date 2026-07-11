import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialInsights } from './entities/social_insights.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../ai/services/prompt-builder.service';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { scopeWhere } from '../../common/workspace-scope.util';

export interface AiAnalyticsReport {
  summary: string;
  topPerformingTraits: string[];
  underperformingTraits: string[];
  contentRecommendations: string[];
  optimalPostingTimes: string[];
}

@Injectable()
export class AiAnalyticsService {
  private readonly logger = new Logger(AiAnalyticsService.name);

  constructor(
    @InjectRepository(SocialInsights)
    private readonly insightsRepo: Repository<SocialInsights>,
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
    private readonly mistral: MistralChatService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async generateReport(tenantId: string, workspaceId?: string): Promise<AiAnalyticsReport | null> {
    const brand = await this.brandRepo.findOne({
      where: scopeWhere(tenantId, workspaceId),
    });

    if (!brand) return null;

    const brandContext = this.promptBuilder.brandFromEntity(brand);
    const systemPrompt = this.promptBuilder.performanceAnalysisSystem(brandContext);

    // Fetch last 30 days of insights
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const insights = await this.insightsRepo
      .createQueryBuilder('insights')
      .where('insights.tenantId = :tenantId', { tenantId })
      .andWhere(workspaceId ? 'insights.workspaceId = :workspaceId' : 'insights.workspaceId IS NULL', { workspaceId })
      .andWhere('insights.date >= :thirtyDaysAgo', { thirtyDaysAgo })
      .orderBy('insights.date', 'ASC')
      .getMany();

    // Fetch top posts
    const topPosts = await this.publicationsRepo.find({
      where: {
        ...scopeWhere<ContentPublications>(tenantId, workspaceId),
        status: 'published',
      },
      order: { engagementScore: 'DESC' },
      take: 10,
    });

    const userMessage = `
# Page Insights (Last 30 Days)
${insights.map((i) => `Date: ${i.date}, Followers: ${i.followersCount}, Reach: ${i.reach}, Impressions: ${i.impressions}`).join('\n')}

# Top Performing Posts
${topPosts.map((p) => `Platform: ${p.platform}, Score: ${p.engagementScore}, Likes: ${p.likeCount}, Content: ${p.publishedContent?.substring(0, 100)}...`).join('\n')}
    `;

    try {
      const result = await this.mistral.completeJson<AiAnalyticsReport>(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        { model: 'mistral-large-latest' }
      );

      return result.data;
    } catch (err) {
      this.logger.error('Failed to generate AI Analytics report', err);
      return null;
    }
  }
}
