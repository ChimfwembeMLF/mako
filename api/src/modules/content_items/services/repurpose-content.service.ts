import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { ContentItems } from '../entities/content_items.entity';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';

const REPURPOSE_PLATFORMS = [
  'linkedin',
  'instagram',
  'facebook',
  'twitter',
] as const;

@Injectable()
export class RepurposeContentService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    private readonly brandProfiles: BrandProfilesService,
  ) {}

  async repurpose(params: {
    contentId: string;
    userId: string;
    targetPlatform?: string;
  }) {
    const source = await this.contentRepo.findOne({
      where: { id: params.contentId },
    });
    if (!source) throw new NotFoundException('Content item not found');

    await this.usage.assertWithinLimit(source.tenantId, params.userId);

    const brand = await this.brandProfiles.resolveForContext({
      tenantId: source.tenantId,
      userId: params.userId,
      workspaceId: source.workspaceId,
    });
    const brandCtx = this.prompts.brandFromEntity(brand);

    const targets = params.targetPlatform
      ? [params.targetPlatform]
      : REPURPOSE_PLATFORMS.filter((p) => !source.platforms?.includes(p));

    let repurposed = 0;
    let totalTokens = 0;

    for (const platform of targets) {
      const { data, tokensUsed } = await this.mistral.completeJson<{
        title?: string;
        content?: string;
      }>([
        {
          role: 'system',
          content: this.prompts.repurposeSystem(brandCtx, platform),
        },
        {
          role: 'user',
          content: `Original title: ${source.title}\nOriginal content:\n${source.content}\n\nAdapt for ${platform}.`,
        },
      ]);

      totalTokens += tokensUsed;
      await this.contentRepo.save(
        this.contentRepo.create({
          tenantId: source.tenantId,
          workspaceId: source.workspaceId,
          userId: params.userId,
          brandProfileId: source.brandProfileId,
          contentType: source.contentType,
          title: data.title?.trim() || `${source.title} (${platform})`,
          content: data.content?.trim() || source.content,
          campaignTheme: source.campaignTheme,
          status: 'draft',
          platforms: [platform],
        }),
      );
      repurposed++;
    }

    await this.usage.record({
      tenantId: source.tenantId,
      userId: params.userId,
      functionName: 'repurpose-content',
      tokensUsed: totalTokens,
    });

    return { repurposed, tokensUsed: totalTokens };
  }
}
