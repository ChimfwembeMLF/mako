import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import {
  PublishResult,
  ContentToPublish,
} from './interfaces/publish-result.interface';
import * as crypto from 'crypto';

@Injectable()
export class TwitterPublishingService {
  private readonly logger = new Logger(TwitterPublishingService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly socialAccountsRepo: Repository<SocialAccounts>,
  ) {}

  async publishPost(
    content: ContentToPublish,
    media: any[] = [],
  ): Promise<PublishResult> {
    try {
      const socialAccount = await this.socialAccountsRepo.findOne({
        where: {
          userId: content.userId,
          platform: 'twitter',
          connected: true,
        },
      });

      if (!socialAccount) {
        return { published: false, message: 'Twitter account not connected' };
      }

      const apiKey = socialAccount.metadata?.api_key;
      const apiSecret = socialAccount.metadata?.api_secret;
      const accessToken = socialAccount.accessToken;
      const accessTokenSecret = socialAccount.metadata?.access_token_secret;

      if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        return {
          published: false,
          message: 'Twitter OAuth 1.0a credentials missing',
        };
      }

      const plainText = content.content.replace(/<[^>]*>/g, '');
      const mediaIds: string[] = [];

      // Upload media attachments
      if (media && media.length > 0) {
        for (const att of media) {
          try {
            const mediaRes = await axios.get(att.media_url, {
              responseType: 'arraybuffer',
            });
            const mediaBuffer = mediaRes.data;
            const totalBytes = mediaBuffer.byteLength;
            const mediaType =
              att.media_type === 'video' ? 'video/mp4' : 'image/jpeg';

            // INIT
            const initRes = await axios.post(
              'https://upload.twitter.com/1.1/media/upload.json',
              new URLSearchParams({
                command: 'INIT',
                total_bytes: totalBytes.toString(),
                media_type: mediaType,
              }),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              },
            );

            const mediaId = initRes.data?.media_id_string;
            if (!mediaId) {
              this.logger.error('Twitter media init failed', initRes.data);
              continue;
            }

            // APPEND (chunked)
            const chunkSize = 1024 * 1024 * 4; // 4MB chunks
            for (let i = 0; i < totalBytes; i += chunkSize) {
              const chunk = mediaBuffer.slice(
                i,
                Math.min(i + chunkSize, totalBytes),
              );
              const form = new FormData();
              form.append('command', 'APPEND');
              form.append('media_id', mediaId);
              form.append('segment_index', (i / chunkSize).toString());
              form.append('media', new Blob([chunk], { type: mediaType }));

              await axios.post(
                'https://upload.twitter.com/1.1/media/upload.json',
                form,
              );
            }

            // FINALIZE
            await axios.post(
              'https://upload.twitter.com/1.1/media/upload.json',
              new URLSearchParams({
                command: 'FINALIZE',
                media_id: mediaId,
              }),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              },
            );

            mediaIds.push(mediaId);
          } catch (err) {
            this.logger.error(`Twitter media upload error`, err);
          }
        }
      }

      // Compose tweet
      const tweetBody: any = { text: plainText };
      if (mediaIds.length > 0) {
        tweetBody.media = { media_ids: mediaIds };
      }

      // POST tweet to v2 API
      const tweetRes = await axios.post(
        'https://api.twitter.com/2/tweets',
        tweetBody,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (tweetRes.data?.data?.id) {
        this.logger.log(`Published to Twitter: ${tweetRes.data.data.id}`);
        return {
          published: true,
          message: `Published to Twitter/X. Tweet ID: ${tweetRes.data.data.id}`,
          externalPostId: tweetRes.data.data.id,
        };
      } else {
        return {
          published: false,
          message: `Twitter error: ${JSON.stringify(tweetRes.data)}`,
        };
      }
    } catch (err) {
      this.logger.error(`Twitter publish error`, err);
      return {
        published: false,
        message: `Twitter publish error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        error: String(err),
      };
    }
  }
}
