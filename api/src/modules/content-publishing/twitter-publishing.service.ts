import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import {
  PublishResult,
  ContentToPublish,
} from './interfaces/publish-result.interface';
import { SocialPublishAccountService } from './social-publish-account.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { SocialAccountsService } from '../social_accounts/social_accounts.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import {
  formatPublishError,
  isTokenAuthError,
  summarizeAxiosError,
} from './publish-error.util';
import {
  oauth1AuthorizationHeader,
  type OAuth1Credentials,
} from '../../common/oauth1.util';

const UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const TWEET_URL = 'https://api.twitter.com/2/tweets';

@Injectable()
export class TwitterPublishingService {
  private readonly logger = new Logger(TwitterPublishingService.name);

  constructor(
    private readonly accounts: SocialPublishAccountService,
    private readonly socialAccounts: SocialAccountsService,
    private readonly mediaResolver: PublishMediaResolverService,
  ) {}

  async publishPost(
    content: ContentToPublish,
    media: any[] = [],
  ): Promise<PublishResult> {
    const socialAccount =
      (await this.accounts.getForPublish(
        content.tenantId,
        content.userId,
        'twitter',
        content.workspaceId,
      )) ??
      (await this.accounts.getForPublish(
        content.tenantId,
        content.userId,
        'x',
        content.workspaceId,
      ));

    if (!socialAccount) {
      return {
        published: false,
        message: 'X / Twitter account not connected for this workspace',
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
      const accessToken = socialAccount.accessToken?.trim();
      if (!accessToken) {
        return {
          published: false,
          message:
            'X / Twitter token missing — reconnect in Connections (/publisher)',
        };
      }

      let plainText = content.content.replace(/<[^>]*>/g, '').trim();
      if (content.title?.trim()) {
        plainText = plainText
          ? `${content.title.trim()}\n\n${plainText}`
          : content.title.trim();
      }
      if (!plainText) {
        return { published: false, message: 'Tweet text is empty' };
      }
      if (plainText.length > 280) {
        plainText = `${plainText.slice(0, 277).trimEnd()}…`;
      }

      const oauth1 = this.oauth1Credentials(socialAccount);
      const resolvedMedia = media?.length
        ? await this.mediaResolver.resolveForPublish(media, content.tenantId)
        : [];

      const mediaIds: string[] = [];
      for (const att of resolvedMedia.slice(0, 4)) {
        try {
          const mediaRes = await axios.get(att.media_url, {
            responseType: 'arraybuffer',
          });
          const mediaBuffer = Buffer.from(mediaRes.data);
          const mediaType =
            att.media_type === 'video' ? 'video/mp4' : 'image/jpeg';
          const id = await this.uploadMedia(
            mediaBuffer,
            mediaType,
            accessToken,
            oauth1,
          );
          if (id) mediaIds.push(id);
        } catch (err) {
          this.logger.warn(
            `Twitter media upload failed: ${summarizeAxiosError(err)}`,
          );
        }
      }

      const tweetBody: { text: string; media?: { media_ids: string[] } } = {
        text: plainText,
      };
      if (mediaIds.length > 0) {
        tweetBody.media = { media_ids: mediaIds };
      }

      const tweetRes = await axios.post(TWEET_URL, tweetBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const tweetId = tweetRes.data?.data?.id as string | undefined;
      if (tweetId) {
        this.logger.log(`Published to X/Twitter: ${tweetId}`);
        return {
          published: true,
          message: `Published to X/Twitter. Tweet ID: ${tweetId}`,
          externalPostId: tweetId,
        };
      }

      return {
        published: false,
        message: `Twitter error: ${JSON.stringify(tweetRes.data)}`,
      };
    } catch (err) {
      if (isTokenAuthError(err) && !retried) {
        try {
          const refreshed =
            await this.socialAccounts.forceRefreshToken(socialAccount);
          return this.publishWithAccount(refreshed, content, media, true);
        } catch (refreshErr) {
          this.logger.warn(
            `Twitter token refresh failed: ${summarizeAxiosError(refreshErr)}`,
          );
        }
      }

      this.logger.error(`Twitter publish error: ${summarizeAxiosError(err)}`);
      return {
        published: false,
        message: formatPublishError(err, 'X/Twitter'),
        error: summarizeAxiosError(err),
      };
    }
  }

  private oauth1Credentials(
    account: SocialAccounts,
  ): OAuth1Credentials | null {
    const meta = account.metadata ?? {};
    const consumerKey = String(meta.api_key ?? '').trim();
    const consumerSecret = String(meta.api_secret ?? '').trim();
    const token = account.accessToken?.trim() ?? '';
    const tokenSecret = String(meta.access_token_secret ?? '').trim();

    if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
      return null;
    }

    return { consumerKey, consumerSecret, token, tokenSecret };
  }

  private async uploadMedia(
    mediaBuffer: Buffer,
    mediaType: string,
    bearerToken: string,
    oauth1: OAuth1Credentials | null,
  ): Promise<string | null> {
    const totalBytes = mediaBuffer.byteLength;

    const authHeader = (extra: Record<string, string>) => {
      if (oauth1) {
        return oauth1AuthorizationHeader('POST', UPLOAD_URL, extra, oauth1);
      }
      return `Bearer ${bearerToken}`;
    };

    const initParams = {
      command: 'INIT',
      total_bytes: totalBytes.toString(),
      media_type: mediaType,
    };

    const initRes = await axios.post(
      UPLOAD_URL,
      new URLSearchParams(initParams),
      {
        headers: {
          Authorization: authHeader(initParams),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const mediaId = initRes.data?.media_id_string as string | undefined;
    if (!mediaId) {
      this.logger.error('Twitter media init failed', initRes.data);
      return null;
    }

    const chunkSize = 4 * 1024 * 1024;
    let segment = 0;
    for (let i = 0; i < totalBytes; i += chunkSize) {
      const chunk = mediaBuffer.subarray(i, Math.min(i + chunkSize, totalBytes));
      const appendParams = {
        command: 'APPEND',
        media_id: mediaId,
        segment_index: segment.toString(),
      };

      const form = new FormData();
      form.append('command', 'APPEND');
      form.append('media_id', mediaId);
      form.append('segment_index', segment.toString());
      form.append('media', chunk, {
        filename: 'media',
        contentType: mediaType,
      });

      await axios.post(UPLOAD_URL, form, {
        headers: {
          Authorization: authHeader(appendParams),
          ...form.getHeaders(),
        },
      });
      segment += 1;
    }

    const finalizeParams = { command: 'FINALIZE', media_id: mediaId };
    await axios.post(UPLOAD_URL, new URLSearchParams(finalizeParams), {
      headers: {
        Authorization: authHeader(finalizeParams),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return mediaId;
  }
}
