import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  PublishResult,
  ContentToPublish,
  MediaAttachment,
} from './interfaces/publish-result.interface';
import { SocialPublishAccountService } from './social-publish-account.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { formatPublishError } from './publish-error.util';
import { formatPlainPostText } from '../../common/text-format.util';

/** Post length limits per channel. */
export const CHANNEL_TEXT_LIMITS = {
  threads: 500,
  pinterest: 800,
  google_business: 1500,
  telegram: 4096,
  telegram_caption: 1024,
};

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;
const notConnected = (name: string): PublishResult => ({
  published: false,
  message: `${name} isn't connected for this workspace`,
});

/**
 * Publishing for the newer channels: Threads, Pinterest, Google Business Profile and
 * Telegram. Each looks up the account the same way as the others (chosen, then default).
 */
@Injectable()
export class NewChannelPublishingService {
  private readonly logger = new Logger(NewChannelPublishingService.name);

  constructor(
    private readonly accounts: SocialPublishAccountService,
    private readonly mediaResolver: PublishMediaResolverService,
  ) {}

  private account(content: ContentToPublish, platform: string) {
    return this.accounts.getForPublish(
      content.tenantId,
      content.userId,
      platform,
      content.workspaceId,
      content.accountId,
    );
  }

  private async firstMedia(media: MediaAttachment[], tenantId: string) {
    if (!media?.length) return null;
    const resolved = await this.mediaResolver.resolveForPublish(
      media,
      tenantId,
    );
    return (
      resolved.find(
        (m) => m.media_type === 'image' || m.media_type === 'video',
      ) ?? null
    );
  }

  /** Threads: create a container, wait for video processing, then publish it. */
  async publishThreads(
    content: ContentToPublish,
    media: MediaAttachment[] = [],
  ): Promise<PublishResult> {
    const account = await this.account(content, 'threads');
    if (!account) return notConnected('Threads');
    const token = account.accessToken;
    const userId = account.externalId;
    if (!token || !userId)
      return {
        published: false,
        message: 'Threads credentials missing. Reconnect Threads.',
      };
    const base = 'https://graph.threads.net/v1.0';
    try {
      const text = clip(
        formatPlainPostText(content.content),
        CHANNEL_TEXT_LIMITS.threads,
      );
      const m = await this.firstMedia(media, content.tenantId);
      const params: Record<string, string> = { access_token: token, text };
      if (m?.media_type === 'image')
        Object.assign(params, { media_type: 'IMAGE', image_url: m.media_url });
      else if (m?.media_type === 'video')
        Object.assign(params, { media_type: 'VIDEO', video_url: m.media_url });
      else params.media_type = 'TEXT';

      const { data: container } = await axios.post(
        `${base}/${userId}/threads`,
        null,
        { params, timeout: 30_000 },
      );
      if (params.media_type === 'VIDEO')
        await this.waitForThreadsContainer(base, container.id, token);
      const { data: post } = await axios.post(
        `${base}/${userId}/threads_publish`,
        null,
        {
          params: { creation_id: container.id, access_token: token },
          timeout: 30_000,
        },
      );
      return {
        published: true,
        message: 'Published to Threads',
        externalPostId: post.id,
      };
    } catch (err) {
      return { published: false, message: formatPublishError(err, 'threads') };
    }
  }

  private async waitForThreadsContainer(
    base: string,
    id: string,
    token: string,
  ) {
    for (let i = 0; i < 20; i++) {
      const { data } = await axios.get(`${base}/${id}`, {
        params: { fields: 'status,error_message', access_token: token },
        timeout: 15_000,
      });
      if (data.status === 'FINISHED') return;
      if (data.status === 'ERROR')
        throw new Error(
          data.error_message || 'Threads could not process the video',
        );
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Threads took too long to process the video');
  }

  /** Pinterest: a Pin needs an image and a board. */
  async publishPinterest(
    content: ContentToPublish,
    media: MediaAttachment[] = [],
  ): Promise<PublishResult> {
    const account = await this.account(content, 'pinterest');
    if (!account) return notConnected('Pinterest');
    const boardId = account.metadata?.board_id as string | undefined;
    if (!boardId)
      return {
        published: false,
        message: 'Choose a Pinterest board: reconnect Pinterest and pick one.',
      };
    const m = await this.firstMedia(media, content.tenantId);
    if (!m || m.media_type !== 'image')
      return {
        published: false,
        message: 'Pinterest needs an image. Add one to this post.',
      };
    try {
      const text = formatPlainPostText(content.content);
      const { data } = await axios.post(
        'https://api.pinterest.com/v5/pins',
        {
          board_id: boardId,
          title: clip(content.title || text.split('\n')[0] || 'New Pin', 100),
          description: clip(text, CHANNEL_TEXT_LIMITS.pinterest),
          media_source: { source_type: 'image_url', url: m.media_url },
        },
        {
          headers: { Authorization: `Bearer ${account.accessToken}` },
          timeout: 30_000,
        },
      );
      return {
        published: true,
        message: 'Pinned to Pinterest',
        externalPostId: data.id,
      };
    } catch (err) {
      return {
        published: false,
        message: formatPublishError(err, 'pinterest'),
      };
    }
  }

  /** Google Business Profile: a "What's new" post on the chosen location. */
  async publishGoogleBusiness(
    content: ContentToPublish,
    media: MediaAttachment[] = [],
  ): Promise<PublishResult> {
    const account = await this.account(content, 'google_business');
    if (!account) return notConnected('Google Business Profile');
    const location = account.metadata?.location_name as string | undefined;
    if (!location)
      return {
        published: false,
        message:
          'Choose a business location: reconnect Google Business Profile.',
      };
    try {
      const m = await this.firstMedia(media, content.tenantId);
      const body: Record<string, unknown> = {
        languageCode: 'en',
        topicType: 'STANDARD',
        summary: clip(
          formatPlainPostText(content.content),
          CHANNEL_TEXT_LIMITS.google_business,
        ),
      };
      if (m?.media_type === 'image')
        body.media = [{ mediaFormat: 'PHOTO', sourceUrl: m.media_url }];
      const { data } = await axios.post(
        `https://mybusiness.googleapis.com/v4/${location}/localPosts`,
        body,
        {
          headers: { Authorization: `Bearer ${account.accessToken}` },
          timeout: 30_000,
        },
      );
      return {
        published: true,
        message: 'Posted to Google Business Profile',
        externalPostId: data.name,
      };
    } catch (err) {
      return {
        published: false,
        message: formatPublishError(err, 'google_business'),
      };
    }
  }

  /** Telegram: the bot posts to the channel or group it was added to. */
  async publishTelegram(
    content: ContentToPublish,
    media: MediaAttachment[] = [],
  ): Promise<PublishResult> {
    const account = await this.account(content, 'telegram');
    if (!account) return notConnected('Telegram');
    const chatId = account.metadata?.chat_id as string | undefined;
    if (!account.accessToken || !chatId)
      return {
        published: false,
        message: 'Telegram bot details missing. Reconnect Telegram.',
      };
    const api = `https://api.telegram.org/bot${account.accessToken}`;
    try {
      const text = formatPlainPostText(content.content);
      const m = await this.firstMedia(media, content.tenantId);
      let res;
      if (m?.media_type === 'image') {
        res = await axios.post(
          `${api}/sendPhoto`,
          {
            chat_id: chatId,
            photo: m.media_url,
            caption: clip(text, CHANNEL_TEXT_LIMITS.telegram_caption),
          },
          { timeout: 30_000 },
        );
      } else if (m?.media_type === 'video') {
        res = await axios.post(
          `${api}/sendVideo`,
          {
            chat_id: chatId,
            video: m.media_url,
            caption: clip(text, CHANNEL_TEXT_LIMITS.telegram_caption),
          },
          { timeout: 60_000 },
        );
      } else {
        res = await axios.post(
          `${api}/sendMessage`,
          { chat_id: chatId, text: clip(text, CHANNEL_TEXT_LIMITS.telegram) },
          { timeout: 30_000 },
        );
      }
      return {
        published: true,
        message: 'Sent to Telegram',
        externalPostId: String(res.data?.result?.message_id ?? ''),
      };
    } catch (err) {
      // Never let the bot token appear in a logged or returned URL.
      const description = (
        err as { response?: { data?: { description?: string } } }
      )?.response?.data?.description;
      this.logger.warn(
        `Telegram publish failed: ${
          description ?? (err as Error)?.message?.replace(/bot[^/]+/g, 'bot***')
        }`,
      );
      return {
        published: false,
        message: description
          ? `Telegram: ${description}`
          : 'Telegram could not send the post',
      };
    }
  }
}
