import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { Workspaces } from '../../workspaces/entities/workspaces.entity';
import { ContentItems } from '../entities/content_items.entity';
import { TemplatesService } from '../../templates/templates.service';
import { EngagementInsightsService } from '../../content_publications/engagement-insights.service';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';

@Injectable()
export class GenerateContentService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    private readonly templates: TemplatesService,
    private readonly engagementInsights: EngagementInsightsService,
    private readonly brandProfiles: BrandProfilesService,
    @InjectRepository(Workspaces)
    private readonly workspaceRepo: Repository<Workspaces>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
  ) {}

  async generate(params: {
    userId: string;
    tenantId?: string;
    workspaceId?: string;
    theme?: string;
    draft?: string;
    contentType?: string;
    platform?: string;
    templateId?: string;
    save?: boolean;
  }) {
    const tenantId = await this.resolveTenantId(
      params.tenantId,
      params.workspaceId,
    );
    await this.usage.assertWithinLimit(tenantId, params.userId);

    const theme = params.theme?.trim() || params.draft?.trim();
    if (!theme)
      throw new BadRequestException('theme or draft content is required');

    const brand = await this.brandProfiles.resolveForContext({
      tenantId,
      userId: params.userId,
      workspaceId: params.workspaceId,
    });
    const brandCtx = this.prompts.brandFromEntity(brand);
    const template = await this.templates.findForGeneration({
      tenantId,
      templateId: params.templateId,
      platform: params.platform,
      contentType: params.contentType,
    });

    const isReply = params.contentType === 'reply';
    const systemPrompt = isReply
      ? this.prompts.commentReplySystem(brandCtx, params.platform ?? 'social')
      : this.prompts.contentGenerationSystem(
          brandCtx,
          params.platform,
          template,
        );

    const topPosts = isReply
      ? []
      : await this.engagementInsights.getTopPerforming(tenantId, 5);
    const tractionBlock = this.engagementInsights.formatForAiPrompt(topPosts);

    const userPrompt = isReply
      ? this.prompts.commentReplyUser({
          platform: params.platform ?? 'social',
          postTitle: undefined,
          postContent: params.draft?.trim() || 'No post context provided.',
          commenterName: 'Commenter',
          commentText: params.theme || '',
        })
      : this.prompts.contentGenerationUser(
          brandCtx,
          params.theme || '',
          params.draft,
          params.contentType,
          tractionBlock,
        );

    const { data, tokensUsed } = await this.mistral.completeJson<{
      title?: string;
      content?: string;
    }>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: isReply ? this.mistral.defaultModel : this.mistral.premiumModel,
      },
    );

    await this.usage.record({
      tenantId,
      userId: params.userId,
      functionName: 'generate-content',
      tokensUsed,
    });

    const title =
      data.title?.trim() || (params.theme || 'Untitled').slice(0, 120);
    const content =
      data.content?.trim() || `<p>${this.escapeHtml(params.theme || '')}</p>`;

    let contentItemId: string | undefined;
    if (
      params.save !== false &&
      params.workspaceId &&
      params.contentType !== 'reply'
    ) {
      if (!brand?.id) {
        throw new BadRequestException(
          'Set up Brand Brain before generating saved content',
        );
      }
      const item = await this.contentRepo.save(
        this.contentRepo.create({
          tenantId,
          workspaceId: params.workspaceId,
          userId: params.userId,
          brandProfileId: brand.id,
          contentType: params.contentType || 'content',
          title,
          content,
          campaignTheme: params.theme,
          status: 'draft',
          platforms: params.platform ? [params.platform] : undefined,
        }),
      );
      contentItemId = item.id;
    }

    return {
      title,
      content,
      contentItemId,
      tokensUsed,
      templateId: template?.id,
      templateName: template?.name,
    };
  }

  private async resolveTenantId(
    tenantId?: string,
    workspaceId?: string,
  ): Promise<string> {
    if (tenantId) return tenantId;
    if (workspaceId) {
      const ws = await this.workspaceRepo.findOne({
        where: { id: workspaceId },
      });
      if (ws?.tenantId) return ws.tenantId;
    }
    throw new BadRequestException('tenantId or workspaceId is required');
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
