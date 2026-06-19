import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MistralAgentsService } from '../../ai/services/mistral-agents.service';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { ContentItems } from '../entities/content_items.entity';
import { MediaAssets } from '../entities/media_assets.entity';

@Injectable()
export class GenerateImageService {
  constructor(
    private readonly agents: MistralAgentsService,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    private readonly brandProfiles: BrandProfilesService,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    @InjectRepository(MediaAssets)
    private readonly mediaRepo: Repository<MediaAssets>,
  ) {}

  async generateImage(params: {
    tenantId: string;
    userId: string;
    prompt: string;
    contentId?: string;
    contentType?: string;
  }) {
    await this.usage.assertWithinLimit(params.tenantId, params.userId);

    let workspaceId: string | undefined;
    if (params.contentId) {
      const item = await this.contentRepo.findOne({
        where: { id: params.contentId },
      });
      workspaceId = item?.workspaceId;
    }

    const brand = await this.brandProfiles.resolveForContext({
      tenantId: params.tenantId,
      userId: params.userId,
      workspaceId,
    });
    const brandCtx = this.prompts.brandFromEntity(brand);
    const fullPrompt = [
      `Create a professional marketing image.`,
      params.prompt,
      brandCtx.companyName ? `Brand: ${brandCtx.companyName}` : '',
      brandCtx.toneOfVoice ? `Tone: ${brandCtx.toneOfVoice}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const { publicUrl } = await this.agents.generateImage(fullPrompt, {
      tenantId: params.tenantId,
    });

    const asset = await this.mediaRepo.save(
      this.mediaRepo.create({
        tenantId: params.tenantId,
        contentId: params.contentId,
        mediaUrl: publicUrl,
        mediaType: 'image',
        name: params.prompt.slice(0, 120),
        uploadedBy: params.userId,
      }),
    );

    await this.usage.record({
      tenantId: params.tenantId,
      userId: params.userId,
      functionName: 'generate-image',
      tokensUsed: 100,
    });

    return {
      media_url: publicUrl,
      media_type: 'image',
      mediaAssetId: asset.id,
    };
  }

  async generateSlideshow(params: {
    tenantId: string;
    userId: string;
    theme: string;
    slideCount?: number;
    contentId?: string;
  }) {
    await this.usage.assertWithinLimit(params.tenantId, params.userId);
    const count = Math.min(Math.max(params.slideCount ?? 4, 2), 8);
    const slides: string[] = [];

    for (let i = 1; i <= count; i++) {
      const { media_url } = await this.generateImage({
        tenantId: params.tenantId,
        userId: params.userId,
        prompt: `${params.theme} — slide ${i} of ${count}, cohesive brand slideshow`,
        contentId: params.contentId,
      });
      slides.push(media_url);
    }

    await this.usage.record({
      tenantId: params.tenantId,
      userId: params.userId,
      functionName: 'generate-slideshow',
      tokensUsed: count * 100,
    });

    return { slides };
  }
}
