import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItems } from '../entities/content_items.entity';
import { MediaAssets } from '../entities/media_assets.entity';
import { SocialAccounts } from '../../social_accounts/entities/social_accounts.entity';
import { FacebookPublishingService } from '../../content-publishing/facebook-publishing.service';
import { InstagramPublishingService } from '../../content-publishing/instagram-publishing.service';
import { LinkedInPublishingService } from '../../content-publishing/linkedin-publishing.service';
import { TwitterPublishingService } from '../../content-publishing/twitter-publishing.service';
import { WhatsappPublishingService } from '../../whatsapp/whatsapp-publishing.service';
import { ContentToPublish, MediaAttachment } from '../../content-publishing/interfaces/publish-result.interface';
import { SupabaseStorageService } from '../../media/supabase-storage.service';
import { ContentPublicationsService } from '../../content_publications/content-publications.service';

type PlatformPayloadStored = {
  content?: string;
  title?: string;
  media?: Array<{ url: string; type?: string; name?: string }>;
  whatsappTemplate?: string;
  whatsappTemplateLanguage?: string;
  whatsappUseTemplate?: boolean;
};

@Injectable()
export class PublishContentService {
  constructor(
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    @InjectRepository(MediaAssets)
    private readonly mediaRepo: Repository<MediaAssets>,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    private readonly publications: ContentPublicationsService,
    private readonly storage: SupabaseStorageService,
    private readonly facebook: FacebookPublishingService,
    private readonly instagram: InstagramPublishingService,
    private readonly linkedin: LinkedInPublishingService,
    private readonly twitter: TwitterPublishingService,
    private readonly whatsapp: WhatsappPublishingService,
  ) {}

  async publish(params: {
    contentId: string;
    userId: string;
    platforms?: string[];
    platformPayloads?: Record<string, PlatformPayloadStored>;
  }) {
    const item = await this.contentRepo.findOne({ where: { id: params.contentId } });
    if (!item) throw new NotFoundException('Content item not found');

    const platforms = params.platforms?.length
      ? params.platforms
      : item.platforms?.length
        ? item.platforms
        : ['facebook'];

    const platformPayloads =
      params.platformPayloads && Object.keys(params.platformPayloads).length
        ? params.platformPayloads
        : this.parsePlatformPayloads(item.platformPayloads);

    this.storage.assertConfigured();

    const defaultMediaRows = await this.mediaRepo.find({
      where: { contentId: item.id, tenantId: item.tenantId },
    });
    const assetUrlByKey = new Map<string, string>();
    for (const row of defaultMediaRows) {
      const key = this.mediaUrlKey(row.mediaUrl);
      assetUrlByKey.set(key, row.mediaUrl);
    }

    const defaultMedia: MediaAttachment[] = defaultMediaRows.map((m) => ({
      id: m.id,
      media_url: m.mediaUrl,
      media_type: (m.mediaType as MediaAttachment['media_type']) || 'image',
      alt_text: m.altText,
    }));

    const results: Record<string, { published: boolean; message: string; externalPostId?: string }> = {};
    let anyPublished = false;

    for (const platform of platforms) {
      const pp = platformPayloads[platform];
      const publishedContent = (pp?.content ?? item.content).replace(/<[^>]*>/g, '').trim();
      const publishedTitle = pp?.title ?? item.title;

      const payload: ContentToPublish = {
        id: item.id,
        content: publishedContent,
        title: publishedTitle,
        userId: params.userId,
        tenantId: item.tenantId,
      };

      let media: MediaAttachment[];
      let publishedMedia: Array<{ url: string; type?: string; name?: string }> | undefined;
      if (pp?.media?.length) {
        media = await Promise.all(
          pp.media.map(async (m, i) => {
            const canonical = assetUrlByKey.get(this.mediaUrlKey(m.url)) ?? m.url;
            const media_url = await this.resolveMediaUrl(canonical, item.tenantId);
            return {
              id: `payload-${platform}-${i}`,
              media_url,
              media_type: (m.type === 'video' ? 'video' : 'image') as MediaAttachment['media_type'],
              alt_text: m.name,
            };
          }),
        );
        publishedMedia = media.map((m) => ({ url: m.media_url, type: m.media_type }));
      } else {
        media = await Promise.all(
          defaultMedia.map(async (m) => ({
            ...m,
            media_url: await this.resolveMediaUrl(m.media_url, item.tenantId, m.id),
          })),
        );
        publishedMedia = media.map((m) => ({ url: m.media_url, type: m.media_type }));
      }

      const socialAccount = await this.socialRepo.findOne({
        where: { tenantId: item.tenantId, userId: params.userId, platform, connected: true },
      }) ?? await this.socialRepo.findOne({
        where: { tenantId: item.tenantId, platform, connected: true },
      });

      const result = await this.dispatch(platform, payload, media, pp);
      results[platform] = {
        published: result.published,
        message: result.message,
        externalPostId: result.externalPostId,
      };

      await this.publications.record({
        tenantId: item.tenantId,
        contentId: item.id,
        userId: params.userId,
        platform,
        publishedContent,
        publishedTitle,
        publishedMedia,
        externalPostId: result.externalPostId,
        socialAccountId: socialAccount?.id,
        status: result.published ? 'published' : 'failed',
        errorMessage: result.published ? undefined : result.message,
      });

      if (result.published) anyPublished = true;
    }

    const primaryExternalId = Object.values(results).find((r) => r.published && r.externalPostId)?.externalPostId;

    if (anyPublished) {
      await this.contentRepo.update(item.id, {
        status: 'published',
        publishedAt: new Date(),
        publishFailedReason: undefined,
        externalPostId: primaryExternalId,
      } as Partial<ContentItems>);
    } else {
      const reasons = Object.entries(results)
        .map(([p, r]) => `${p}: ${r.message}`)
        .join('; ');
      await this.contentRepo.update(item.id, {
        publishFailedReason: reasons,
      } as Partial<ContentItems>);
    }

    return { published: anyPublished, results };
  }

  private async resolveMediaUrl(
    url: string,
    tenantId: string,
    assetId?: string,
  ): Promise<string> {
    const resolved = await this.storage.ensureSupabaseUrl(url, tenantId);
    if (assetId && resolved !== url) {
      await this.mediaRepo.update(assetId, { mediaUrl: resolved });
    }
    return resolved;
  }

  private mediaUrlKey(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url, 'http://local');
      return parsed.pathname;
    } catch {
      return url.replace(/^https?:\/\/[^/]+/, '');
    }
  }

  private parsePlatformPayloads(raw: unknown): Record<string, PlatformPayloadStored> {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as Record<string, PlatformPayloadStored>;
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') {
      return raw as Record<string, PlatformPayloadStored>;
    }
    return {};
  }

  private async dispatch(
    platform: string,
    content: ContentToPublish,
    media: MediaAttachment[],
    platformPayload?: PlatformPayloadStored,
  ) {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return this.facebook.publishPost(content, media);
      case 'instagram':
        return this.instagram.publishPost(content, media);
      case 'linkedin':
        return this.linkedin.publishPost(content, media);
      case 'twitter':
      case 'x':
        return this.twitter.publishPost(content, media);
      case 'whatsapp':
        return this.whatsapp.publishPost(content, media, {
          templateName: platformPayload?.whatsappTemplate,
          templateLanguage: platformPayload?.whatsappTemplateLanguage,
          useTemplate: platformPayload?.whatsappUseTemplate,
        });
      default:
        return { published: false, message: `Unsupported platform: ${platform}` };
    }
  }
}
