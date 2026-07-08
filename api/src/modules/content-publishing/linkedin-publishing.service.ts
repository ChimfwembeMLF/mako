import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  PublishResult,
  ContentToPublish,
} from './interfaces/publish-result.interface';
import { SocialPublishAccountService } from './social-publish-account.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import {
  formatPublishError,
  isTokenAuthError,
  summarizeAxiosError,
} from './publish-error.util';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { SocialAccountsService } from '../social_accounts/social_accounts.service';

@Injectable()
export class LinkedInPublishingService {
  private readonly logger = new Logger(LinkedInPublishingService.name);

  constructor(
    private readonly accounts: SocialPublishAccountService,
    private readonly socialAccounts: SocialAccountsService,
    private readonly mediaResolver: PublishMediaResolverService,
  ) {}

  async publishPost(
    content: ContentToPublish,
    media: any[] = [],
  ): Promise<PublishResult> {
    const socialAccount = await this.accounts.getForPublish(
      content.tenantId,
      content.userId,
      'linkedin',
      content.workspaceId,
    );

    if (!socialAccount) {
      return {
        published: false,
        message: 'LinkedIn account not connected for this workspace',
      };
    }

    return this.publishWithAccount(socialAccount, content, media, false);
  }

  private async publishWithAccount(
    socialAccount: SocialAccounts,
    content: ContentToPublish,
    media: any[],
    retried: boolean,
  ): Promise<PublishResult> {
    try {
      const liToken = socialAccount.accessToken;
      const liPersonId = this.accounts.getLinkedInPersonId(socialAccount);

      if (!liToken || !liPersonId) {
        return {
          published: false,
          message:
            'LinkedIn credentials missing — reconnect LinkedIn in Publisher Connect',
        };
      }

      const plainText = content.content.replace(/<[^>]*>/g, '');
      const mediaArray: Array<{ status: string; media: string }> = [];
      let shareMediaCategory = 'NONE';

      const resolvedMedia = media?.length
        ? await this.mediaResolver.resolveForPublish(media, content.tenantId)
        : [];

      for (const att of resolvedMedia) {
        try {
          let recipe: string | null = null;
          let mediaType: string | null = null;

          if (att.media_type === 'image') {
            recipe = 'urn:li:digitalmediaRecipe:feedshare-image';
            mediaType = 'IMAGE';
          } else if (att.media_type === 'video') {
            recipe = 'urn:li:digitalmediaRecipe:feedshare-video';
            mediaType = 'VIDEO';
          } else {
            continue;
          }

          const registerRes = await axios.post(
            'https://api.linkedin.com/v2/assets?action=registerUpload',
            {
              registerUploadRequest: {
                owner: `urn:li:person:${liPersonId}`,
                recipes: [recipe],
                serviceRelationships: [
                  {
                    relationshipType: 'OWNER',
                    identifier: 'urn:li:userGeneratedContent',
                  },
                ],
              },
            },
            {
              headers: {
                Authorization: `Bearer ${liToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            },
          );

          const uploadUrl =
            registerRes.data?.value?.uploadMechanism?.[
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
            ]?.uploadUrl;
          const asset = registerRes.data?.value?.asset;

          if (uploadUrl && asset) {
            const local = this.mediaResolver.readLocalUpload(att.media_url);
            const mediaBlob = local
              ? local.buffer
              : (
                  await axios.get(att.media_url, {
                    responseType: 'arraybuffer',
                  })
                ).data;

            await axios.put(uploadUrl, mediaBlob, {
              headers: { 'Content-Type': 'application/octet-stream' },
            });

            mediaArray.push({ status: 'READY', media: asset });

            if (mediaType === 'VIDEO') {
              shareMediaCategory = 'VIDEO';
            } else if (shareMediaCategory !== 'VIDEO') {
              shareMediaCategory = 'IMAGE';
            }
          }
        } catch (err) {
          if (isTokenAuthError(err)) {
            throw err;
          }
          this.logger.warn(
            `LinkedIn media upload skipped: ${summarizeAxiosError(err)}`,
          );
        }
      }

      const postBody: Record<string, unknown> = {
        author: `urn:li:person:${liPersonId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: plainText },
            shareMediaCategory,
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      if (mediaArray.length > 0) {
        (postBody.specificContent as Record<string, Record<string, unknown>>)[
          'com.linkedin.ugc.ShareContent'
        ].media = mediaArray;
      }

      const res = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        postBody,
        {
          headers: {
            Authorization: `Bearer ${liToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      );

      const externalPostId =
        res.headers['x-restli-id'] ?? res.data?.id ?? undefined;

      if (res.status === 201 || externalPostId) {
        this.logger.log(`Published to LinkedIn: ${externalPostId}`);
        return {
          published: true,
          message: 'Published to LinkedIn.',
          externalPostId,
        };
      }

      return {
        published: false,
        message: `LinkedIn error: ${JSON.stringify(res.data)}`,
      };
    } catch (err) {
      if (!retried && isTokenAuthError(err) && socialAccount.refreshToken) {
        const refreshed = await this.socialAccounts.forceRefreshToken(
          socialAccount,
        );
        if (
          refreshed.accessToken &&
          refreshed.accessToken !== socialAccount.accessToken
        ) {
          return this.publishWithAccount(refreshed, content, media, true);
        }
      }

      if (isTokenAuthError(err)) {
        await this.accounts.markDisconnectedOnAuthError(socialAccount, err);
        const message = formatPublishError(err, 'LinkedIn');
        this.logger.warn(`LinkedIn auth failed: ${summarizeAxiosError(err)}`);
        return { published: false, message };
      }

      this.logger.error(`LinkedIn publish error: ${summarizeAxiosError(err)}`);
      return {
        published: false,
        message: formatPublishError(err, 'LinkedIn'),
      };
    }
  }
}
