import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { BrandProfiles } from '../../brand_profiles/entities/brand_profiles.entity';
import { platformPublishGuide } from '../platform-publish.constants';
import { TemplatesService } from '../../templates/templates.service';
import { ContentTemplates } from '../../templates/entities/content_templates.entity';

export type AdaptedPlatformPayload = {
  title: string;
  content: string;
};

@Injectable()
export class AdaptPlatformsService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    private readonly templates: TemplatesService,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
  ) {}

  async adapt(params: {
    tenantId: string;
    userId: string;
    platforms: string[];
    title?: string;
    content: string;
  }): Promise<{ payloads: Record<string, AdaptedPlatformPayload>; tokensUsed: number }> {
    if (!params.tenantId) throw new BadRequestException('tenantId is required');
    if (!params.platforms?.length) throw new BadRequestException('platforms is required');
    if (!params.content?.trim()) throw new BadRequestException('content is required');

    await this.usage.assertWithinLimit(params.tenantId, params.userId);

    const brand = await this.brandRepo.findOne({
      where: { tenantId: params.tenantId, userId: params.userId },
    });
    const brandCtx = this.prompts.brandFromEntity(brand);
    const plainSource = params.content.replace(/<[^>]*>/g, '').trim();

    const templateByPlatform = new Map<string, ContentTemplates>();
    const platformGuides = await Promise.all(
      params.platforms.map(async (platform) => {
        const template = await this.templates.findActiveForPlatform(params.tenantId, platform);
        if (template) templateByPlatform.set(platform, template);
        const base = platformPublishGuide(platform);
        const guide = template?.body?.trim()
          ? {
              ...base,
              format: `${base.format}\n\nTemplate instructions:\n${template.body.trim()}`,
            }
          : base;
        return { platform, guide, template };
      }),
    );

    let totalTokens = 0;
    let payloads: Record<string, AdaptedPlatformPayload> = {};

    if (params.platforms.length === 1) {
      const { payload, tokensUsed } = await this.adaptOne(
        brandCtx,
        params.platforms[0],
        plainSource,
        params.title,
        undefined,
        templateByPlatform.get(params.platforms[0]),
      );
      totalTokens += tokensUsed;
      payloads[params.platforms[0]] = payload;
    } else {
      const batch = await this.adaptBatch(brandCtx, platformGuides, plainSource, params.title);
      totalTokens += batch.tokensUsed;
      payloads = batch.payloads;

      const missing = params.platforms.filter((p) => !payloads[p]?.content?.trim());
      for (const platform of missing) {
        const { payload, tokensUsed } = await this.adaptOne(
          brandCtx,
          platform,
          plainSource,
          params.title,
          payloads,
          templateByPlatform.get(platform),
        );
        totalTokens += tokensUsed;
        payloads[platform] = payload;
      }

      const duplicates = this.findDuplicatePlatforms(payloads, params.platforms);
      for (const platform of duplicates) {
        const summaries = params.platforms
          .filter((p) => p !== platform && payloads[p]?.content)
          .map((p) => `${p}: ${payloads[p].content.slice(0, 120)}…`)
          .join('\n');
        const guide = platformPublishGuide(platform);
        const template = templateByPlatform.get(platform);
        const { data, tokensUsed } = await this.mistral.completeJson<{ title?: string; content?: string }>(
          [
            {
              role: 'system',
              content: template
                ? this.prompts.platformAdaptDistinctRetry(brandCtx, platform, guide, summaries) +
                  `\n\nTemplate instructions:\n${template.body}`
                : this.prompts.platformAdaptDistinctRetry(brandCtx, platform, guide, summaries),
            },
            {
              role: 'user',
              content: [
                `Original title: ${params.title || 'Untitled'}`,
                `Original content:\n${plainSource}`,
                `Write a DISTINCT ${platform} version.`,
              ].join('\n\n'),
            },
          ],
        );
        totalTokens += tokensUsed;
        payloads[platform] = this.normalizeEntry(platform, data, params.title, plainSource);
      }
    }

    await this.usage.record({
      tenantId: params.tenantId,
      userId: params.userId,
      functionName: 'adapt-platforms',
      tokensUsed: totalTokens,
    });

    return { payloads, tokensUsed: totalTokens };
  }

  private async adaptBatch(
    brandCtx: ReturnType<PromptBuilderService['brandFromEntity']>,
    platformGuides: Array<{ platform: string; guide: ReturnType<typeof platformPublishGuide> }>,
    plainSource: string,
    title?: string,
  ) {
    const { data, tokensUsed } = await this.mistral.completeJson<
      Record<string, { title?: string; content?: string }>
    >([
      {
        role: 'system',
        content: this.prompts.platformAdaptBatchSystem(brandCtx, platformGuides),
      },
      {
        role: 'user',
        content: [
          `Original title: ${title || 'Untitled'}`,
          `Original content:\n${plainSource}`,
          `Return separate adapted copy for each platform: ${platformGuides.map((p) => p.platform).join(', ')}.`,
        ].join('\n\n'),
      },
    ]);

    const payloads: Record<string, AdaptedPlatformPayload> = {};
    for (const { platform } of platformGuides) {
      const entry = data[platform] ?? data[platform.toLowerCase()];
      if (entry) {
        payloads[platform] = this.normalizeEntry(platform, entry, title, plainSource);
      }
    }

    return { payloads, tokensUsed };
  }

  private async adaptOne(
    brandCtx: ReturnType<PromptBuilderService['brandFromEntity']>,
    platform: string,
    plainSource: string,
    title?: string,
    existing?: Record<string, AdaptedPlatformPayload>,
    template?: ContentTemplates | null,
  ) {
    const guide = platformPublishGuide(platform);
    const otherSummaries = existing
      ? Object.entries(existing)
          .filter(([p]) => p !== platform)
          .map(([p, v]) => `${p}: ${v.content.slice(0, 100)}…`)
          .join('\n')
      : '';

    const system = otherSummaries
      ? this.prompts.platformAdaptDistinctRetry(brandCtx, platform, guide, otherSummaries)
      : this.prompts.platformAdaptSystem(brandCtx, platform, guide, template);

    const { data, tokensUsed } = await this.mistral.completeJson<{ title?: string; content?: string }>(
      [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            `Original title: ${title || 'Untitled'}`,
            `Original content:\n${plainSource}`,
            `Adapt specifically for ${platform}. Follow current ${platform} content trends.`,
          ].join('\n\n'),
        },
      ],
    );

    return {
      payload: this.normalizeEntry(platform, data, title, plainSource),
      tokensUsed,
    };
  }

  private normalizeEntry(
    platform: string,
    data: { title?: string; content?: string },
    title?: string,
    fallbackContent?: string,
  ): AdaptedPlatformPayload {
    const guide = platformPublishGuide(platform);
    let content = (data.content ?? fallbackContent ?? '').replace(/<[^>]*>/g, '').trim();
    if (content.length > guide.maxChars) {
      content = content.slice(0, guide.maxChars - 1).trimEnd() + '…';
    }
    return {
      title: data.title?.trim() || title || platform,
      content,
    };
  }

  private findDuplicatePlatforms(
    payloads: Record<string, AdaptedPlatformPayload>,
    platforms: string[],
  ): string[] {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const p of platforms) {
      const key = payloads[p]?.content?.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) {
        dupes.push(p);
      } else {
        seen.set(key, p);
      }
    }
    return dupes;
  }
}
