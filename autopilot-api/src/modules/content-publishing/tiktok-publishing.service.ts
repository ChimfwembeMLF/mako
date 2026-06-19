import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  PublishResult,
  ContentToPublish,
} from './interfaces/publish-result.interface';
import { SocialPublishAccountService } from './social-publish-account.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { formatPublishError } from './publish-error.util';

type TikTokApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string };
};

type CreatorInfo = {
  creator_nickname?: string;
  creator_username?: string;
  privacy_level_options?: string[];
  max_video_post_duration_sec?: number;
  can_post_more?: boolean;
};

@Injectable()
export class TiktokPublishingService {
  private readonly logger = new Logger(TiktokPublishingService.name);
  private readonly apiBase = 'https://open.tiktokapis.com/v2';

  constructor(
    private readonly accounts: SocialPublishAccountService,
    private readonly mediaResolver: PublishMediaResolverService,
  ) {}

  async publishPost(
    content: ContentToPublish,
    media: any[] = [],
  ): Promise<PublishResult> {
    try {
      const account = await this.accounts.getForPublish(
        content.tenantId,
        content.userId,
        'tiktok',
        content.workspaceId,
      );

      if (!account?.accessToken) {
        return {
          published: false,
          message: 'TikTok not connected for this workspace',
        };
      }

      const resolvedMedia = media?.length
        ? await this.mediaResolver.resolveForPublish(media, content.tenantId)
        : [];

      const video = resolvedMedia.find((m) => m.media_type === 'video');
      if (!video?.media_url) {
        return {
          published: false,
          message:
            'TikTok requires a video attachment. Add a vertical video in Content Engine before publishing.',
        };
      }

      const creatorInfo = await this.queryCreatorInfo(account.accessToken);
      if (creatorInfo.can_post_more === false) {
        return {
          published: false,
          message:
            'TikTok rate limit reached for this creator — try again later.',
        };
      }

      const privacyLevel = this.pickPrivacyLevel(
        creatorInfo.privacy_level_options,
      );
      const caption = this.buildCaption(content);
      const publishId = await this.initVideoPublish(
        account.accessToken,
        video.media_url,
        caption,
        privacyLevel,
        creatorInfo,
      );

      const status = await this.pollPublishStatus(
        account.accessToken,
        publishId,
      );
      if (status.status === 'FAILED') {
        return {
          published: false,
          message: `TikTok publish failed: ${
            status.fail_reason ?? 'unknown error'
          }`,
        };
      }

      const postId = status.publicly_available_post_id?.[0] ?? status.post_id;
      return {
        published: true,
        message:
          privacyLevel === 'SELF_ONLY'
            ? 'Video uploaded to TikTok (private — app may be unaudited; submit for review to post publicly)'
            : 'Video published to TikTok',
        externalPostId: postId,
      };
    } catch (err) {
      this.logger.error('TikTok publish failed', err);
      return {
        published: false,
        message: formatPublishError(err, 'TikTok'),
      };
    }
  }

  private buildCaption(content: ContentToPublish): string {
    const plain = content.content.replace(/<[^>]*>/g, '').trim();
    const title = content.title?.trim();
    const combined = title && plain ? `${title}\n\n${plain}` : title || plain;
    return combined.slice(0, 2200);
  }

  private pickPrivacyLevel(options?: string[]): string {
    const list = options?.length ? options : ['SELF_ONLY'];
    if (list.includes('PUBLIC_TO_EVERYONE')) return 'PUBLIC_TO_EVERYONE';
    if (list.includes('MUTUAL_FOLLOW_FRIENDS')) return 'MUTUAL_FOLLOW_FRIENDS';
    if (list.includes('FOLLOWER_OF_CREATOR')) return 'FOLLOWER_OF_CREATOR';
    return list[0] ?? 'SELF_ONLY';
  }

  private async queryCreatorInfo(accessToken: string): Promise<CreatorInfo> {
    const data = await this.tiktokPost<CreatorInfo>(
      accessToken,
      '/post/publish/creator_info/query/',
      {},
    );
    return data ?? {};
  }

  private async initVideoPublish(
    accessToken: string,
    videoUrl: string,
    title: string,
    privacyLevel: string,
    creatorInfo: CreatorInfo,
  ): Promise<string> {
    const data = await this.tiktokPost<{
      publish_id?: string;
    }>(accessToken, '/post/publish/video/init/', {
      post_info: {
        title,
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    });

    if (!data?.publish_id) {
      throw new Error('TikTok did not return a publish_id');
    }

    if (
      creatorInfo.max_video_post_duration_sec &&
      creatorInfo.max_video_post_duration_sec < 60
    ) {
      this.logger.warn(
        `TikTok creator max duration is ${creatorInfo.max_video_post_duration_sec}s`,
      );
    }

    return data.publish_id;
  }

  private async pollPublishStatus(
    accessToken: string,
    publishId: string,
    maxAttempts = 30,
  ): Promise<{
    status?: string;
    fail_reason?: string;
    publicly_available_post_id?: string[];
    post_id?: string;
  }> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const data = await this.tiktokPost<{
        status?: string;
        fail_reason?: string;
        publicly_available_post_id?: string[];
        post_id?: string;
      }>(accessToken, '/post/publish/status/fetch/', { publish_id: publishId });

      const status = data?.status;
      if (
        status === 'PUBLISH_COMPLETE' ||
        status === 'FAILED' ||
        status === 'SEND_TO_USER_INBOX'
      ) {
        return data ?? {};
      }

      await this.sleep(2000);
    }

    throw new Error('TikTok publish timed out while processing');
  }

  private async tiktokPost<T>(
    accessToken: string,
    path: string,
    body: Record<string, unknown>,
  ): Promise<T | undefined> {
    const { data } = await axios.post<TikTokApiEnvelope<T>>(
      `${this.apiBase}${path}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        timeout: 120_000,
      },
    );

    if (data.error?.code && data.error.code !== 'ok') {
      throw new Error(
        data.error.message || `TikTok API error: ${data.error.code}`,
      );
    }

    return data.data;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
