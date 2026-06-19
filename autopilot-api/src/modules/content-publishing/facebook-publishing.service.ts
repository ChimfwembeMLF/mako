import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import {
  PublishResult,
  ContentToPublish,
} from './interfaces/publish-result.interface';
import { SocialPublishAccountService } from './social-publish-account.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { formatPublishError } from './publish-error.util';
import {
  formatContentForPlatform,
  formatPlainPostText,
} from '../../common/text-format.util';

@Injectable()
export class FacebookPublishingService {
  private readonly logger = new Logger(FacebookPublishingService.name);

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
        'facebook',
        content.workspaceId,
      );

      if (!socialAccount) {
        return {
          published: false,
          message: 'Facebook account not connected for this workspace',
        };
      }

      const pageToken = this.accounts.getFacebookPageToken(socialAccount);
      const pageId =
        socialAccount.externalId ?? socialAccount.metadata?.page_id;

      if (!pageToken || !pageId) {
        return {
          published: false,
          message:
            'Facebook page token missing — reconnect Facebook in Publisher Connect',
        };
      }

      const pageCheck = await this.verifyPageAccess(
        pageId,
        socialAccount.accessToken,
        socialAccount.metadata?.page_name as string | undefined,
      );
      if (pageCheck) {
        return { published: false, message: pageCheck };
      }

      const plainText = formatContentForPlatform(
        'facebook',
        formatPlainPostText(content.content),
      );
      const resolvedMedia = await this.mediaResolver.resolveForPublish(
        media,
        content.tenantId,
      );
      const attachedMedia: Array<{ media_fbid: string }> = [];

      for (const att of resolvedMedia) {
        try {
          if (att.media_type !== 'image' && att.media_type !== 'video')
            continue;

          if (att.media_type === 'image') {
            const photoId = await this.uploadImage(
              pageId,
              pageToken,
              att.media_url,
            );
            if (photoId) attachedMedia.push({ media_fbid: photoId });
          } else if (att.media_type === 'video') {
            const videoId = await this.uploadVideo(
              pageId,
              pageToken,
              att.media_url,
              plainText,
            );
            if (videoId) attachedMedia.push({ media_fbid: videoId });
          }
        } catch (err) {
          this.logger.error(
            `Facebook media upload failed for ${att.media_url}`,
            err,
          );
        }
      }

      if (resolvedMedia.length > 0 && attachedMedia.length === 0) {
        return {
          published: false,
          message:
            'Facebook could not upload media attachments. Ensure images are public HTTPS URLs or enable Supabase storage.',
        };
      }

      const postBody: Record<string, unknown> = {
        message: plainText,
        access_token: pageToken,
      };
      if (attachedMedia.length > 0) {
        postBody.attached_media = attachedMedia;
      }

      const postRes = await axios.post(
        `https://graph.facebook.com/v19.0/${pageId}/feed`,
        postBody,
      );

      if (postRes.data?.id) {
        this.logger.log(`Published to Facebook: ${postRes.data.id}`);
        return {
          published: true,
          message: `Published to Facebook. Post ID: ${postRes.data.id}`,
          externalPostId: postRes.data.id,
        };
      }

      return {
        published: false,
        message: `Facebook error: ${JSON.stringify(
          postRes.data?.error || postRes.data,
        )}`,
      };
    } catch (err) {
      this.logger.error(`Facebook publish error`, err);
      return {
        published: false,
        message: formatPublishError(err, 'Facebook'),
        error: String(err),
      };
    }
  }

  /**
   * Ensure the connected Meta user still manages the target Page (e.g. after a new admin invite).
   */
  private async verifyPageAccess(
    pageId: string,
    userToken?: string,
    pageName?: string,
  ): Promise<string | null> {
    if (!userToken?.trim()) return null;

    try {
      const { data } = await axios.get<{
        data?: Array<{ id: string; name?: string; tasks?: string[] }>;
      }>('https://graph.facebook.com/v19.0/me/accounts', {
        params: {
          access_token: userToken,
          fields: 'id,name,tasks,access_token',
        },
      });

      const pages = data.data ?? [];
      const page = pages.find((p) => p.id === pageId);
      if (!page) {
        const label = pageName ? `"${pageName}"` : 'this Page';
        return (
          `Facebook: ${label} is not linked to your connected Meta account. ` +
          'You may have been invited after connecting — open Publisher Connect, disconnect Facebook, ' +
          'reconnect, and select the correct Page.'
        );
      }

      const tasks = page.tasks ?? [];
      if (
        tasks.length > 0 &&
        !tasks.includes('CREATE_CONTENT') &&
        !tasks.includes('MANAGE') &&
        !tasks.includes('MODERATE')
      ) {
        return (
          `Facebook: your role on "${
            page.name ?? pageId
          }" does not include publishing. ` +
          'Ask the Page owner for Admin or Editor access.'
        );
      }

      return null;
    } catch (err) {
      this.logger.warn(`Facebook page access check skipped: ${err}`);
      return null;
    }
  }

  private async uploadImage(
    pageId: string,
    pageToken: string,
    mediaUrl: string,
  ): Promise<string | null> {
    const local = this.mediaResolver.readLocalUpload(mediaUrl);
    if (local) {
      const form = new FormData();
      form.append('source', local.buffer, {
        filename: local.filename,
        contentType: local.contentType,
      });
      form.append('published', 'false');
      form.append('access_token', pageToken);
      const res = await axios.post(
        `https://graph.facebook.com/v19.0/${pageId}/photos`,
        form,
        { headers: form.getHeaders() },
      );
      return res.data?.id ?? null;
    }

    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${pageId}/photos`,
      {
        url: mediaUrl,
        published: false,
        access_token: pageToken,
      },
    );
    return res.data?.id ?? null;
  }

  private async uploadVideo(
    pageId: string,
    pageToken: string,
    mediaUrl: string,
    description: string,
  ): Promise<string | null> {
    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${pageId}/videos`,
      {
        file_url: mediaUrl,
        description,
        access_token: pageToken,
      },
    );
    return res.data?.id ?? null;
  }
}
