import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'stream';
import {
  PublishResult,
  ContentToPublish,
} from './interfaces/publish-result.interface';
import { SocialPublishAccountService } from './social-publish-account.service';
import { PublishMediaResolverService } from './publish-media-resolver.service';
import { formatPublishError } from './publish-error.util';

@Injectable()
export class YoutubePublishingService {
  private readonly logger = new Logger(YoutubePublishingService.name);

  constructor(
    private readonly config: ConfigService,
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
        'youtube',
        content.workspaceId,
      );

      if (!account) {
        return {
          published: false,
          message: 'YouTube channel not connected for this workspace',
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
            'YouTube requires a video attachment. Add a video in Content Engine before publishing.',
        };
      }

      const auth = this.oauthClient(account);
      const youtube = google.youtube({ version: 'v3', auth });

      const title = (content.title || 'Mako  upload').trim().slice(0, 100);
      const description = content.content
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, 5000);

      const videoStream = await this.streamFromUrl(video.media_url);

      const { data } = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description: description || title,
            categoryId: '22',
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: videoStream,
        },
      });

      const videoId = data.id;
      if (!videoId) {
        return {
          published: false,
          message: 'YouTube upload completed but no video ID was returned',
        };
      }

      return {
        published: true,
        message: 'Video published to YouTube',
        externalPostId: videoId,
      };
    } catch (err) {
      this.logger.error('YouTube publish failed', err);
      return {
        published: false,
        message: formatPublishError(err, 'YouTube'),
      };
    }
  }

  oauthClient(account: { accessToken?: string; refreshToken?: string }) {
    const client = new google.auth.OAuth2(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
    );
    client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });
    return client;
  }

  private async streamFromUrl(url: string): Promise<Readable> {
    const res = await axios.get<Readable>(url, {
      responseType: 'stream',
      timeout: 120_000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return res.data;
  }
}
