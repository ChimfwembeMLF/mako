import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  PublishResult,
  ContentToPublish,
} from './interfaces/publish-result.interface';
import { SocialPublishAccountService } from './social-publish-account.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { formatGraphApiError, formatPublishError } from './publish-error.util';
import {
  formatContentForPlatform,
  formatPlainPostText,
} from '../../common/text-format.util';

@Injectable()
export class InstagramPublishingService {
  private readonly logger = new Logger(InstagramPublishingService.name);

  constructor(
    private readonly accounts: SocialPublishAccountService,
    private readonly mediaResolver: PublishMediaResolverService,
  ) {}

  async publishPost(
    content: ContentToPublish,
    media: any[] = [],
  ): Promise<PublishResult> {
    try {
      const socialAccount = await this.accounts.getForPublish(
        content.tenantId,
        content.userId,
        'instagram',
        content.workspaceId,
      );

      if (!socialAccount) {
        return {
          published: false,
          message: 'Instagram account not connected for this workspace',
        };
      }

      const igToken = this.accounts.getInstagramToken(socialAccount);
      const igAccountId =
        socialAccount.externalId ??
        socialAccount.metadata?.instagram_business_account_id;

      if (!igToken || !igAccountId) {
        return {
          published: false,
          message:
            'Instagram credentials missing — reconnect Instagram in Publisher Connect',
        };
      }

      const plainText = formatContentForPlatform(
        'instagram',
        formatPlainPostText(content.content),
      );

      if (!media?.length) {
        return {
          published: false,
          message: 'Instagram requires at least one image or video attachment',
        };
      }

      const resolvedMedia = await this.mediaResolver.resolveForPublish(
        media,
        content.tenantId,
      );
      const containerIds: string[] = [];

      for (const m of resolvedMedia) {
        const containerPayload: Record<string, unknown> = {
          access_token: igToken,
          caption: plainText,
        };

        if (resolvedMedia.length > 1) {
          containerPayload.is_carousel_item = true;
        }
        if (m.alt_text) containerPayload.alt_text = m.alt_text;

        if (m.media_type === 'image') {
          containerPayload.image_url = m.media_url;
        } else if (m.media_type === 'video') {
          containerPayload.media_type = 'VIDEO';
          containerPayload.video_url = m.media_url;
        } else {
          continue;
        }

        const containerRes = await axios.post(
          `https://graph.facebook.com/v19.0/${igAccountId}/media`,
          containerPayload,
        );

        if (containerRes.data?.error) {
          return {
            published: false,
            message: formatGraphApiError(containerRes.data, 'Instagram'),
          };
        }

        if (!containerRes.data?.id) {
          throw new Error(
            `Failed to create media container: ${JSON.stringify(
              containerRes.data,
            )}`,
          );
        }

        containerIds.push(containerRes.data.id);
      }

      if (!containerIds.length) {
        return {
          published: false,
          message: 'No valid Instagram media containers created',
        };
      }

      let creationId: string;

      if (containerIds.length === 1) {
        creationId = containerIds[0];
      } else {
        const carouselRes = await axios.post(
          `https://graph.facebook.com/v19.0/${igAccountId}/media`,
          {
            media_type: 'CAROUSEL',
            children: containerIds,
            caption: plainText,
            access_token: igToken,
          },
        );
        if (carouselRes.data?.error || !carouselRes.data?.id) {
          return {
            published: false,
            message: formatGraphApiError(carouselRes.data ?? {}, 'Instagram'),
          };
        }
        creationId = carouselRes.data.id;
      }

      const publishRes = await axios.post(
        `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
        { creation_id: creationId, access_token: igToken },
      );

      if (publishRes.data?.error) {
        return {
          published: false,
          message: formatGraphApiError(publishRes.data, 'Instagram'),
        };
      }

      if (publishRes.data?.id) {
        this.logger.log(`Published to Instagram: ${publishRes.data.id}`);
        return {
          published: true,
          message: `Published to Instagram. Post ID: ${publishRes.data.id}`,
          externalPostId: publishRes.data.id,
        };
      }

      return {
        published: false,
        message: `Instagram publish error: ${JSON.stringify(publishRes.data)}`,
      };
    } catch (err) {
      this.logger.error(`Instagram publish error`, err);
      return {
        published: false,
        message: formatPublishError(err, 'Instagram'),
        error: String(err),
      };
    }
  }
}
