import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { google } from 'googleapis';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { YoutubePublishingService } from './youtube-publishing.service';
import { SocialPublishAccountService } from './social-publish-account.service';
import { summarizeAxiosError } from './publish-error.util';
import { scopeWhereIncludingTenantWide } from '../../common/workspace-scope.util';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

export type EngagementMetrics = {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
};

export function computeEngagementScore(m: EngagementMetrics): number {
  return Math.round(
    m.likeCount + m.commentCount * 3 + m.shareCount * 5 + m.viewCount * 0.01,
  );
}

@Injectable()
export class PublicationEngagementService {
  private readonly logger = new Logger(PublicationEngagementService.name);

  constructor(
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    private readonly youtubePublish: YoutubePublishingService,
    private readonly publishAccounts: SocialPublishAccountService,
  ) {}

  async syncForTenant(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<number> {
    const qb = this.publicationsRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.externalPostId IS NOT NULL');

    if (workspaceId) {
      qb.andWhere(
        '(p.workspaceId = :workspaceId OR p.workspaceId IS NULL)',
        { workspaceId },
      );
    }

    const publications = await qb.getMany();

    let updated = 0;
    for (const pub of publications) {
      if (!pub.externalPostId) continue;
      try {
        const account = await this.resolveAccount(pub, tenantId, userId);
        if (!account) {
          this.logger.debug(
            `Engagement sync skipped — no connected ${pub.platform} account for publication ${pub.id}`,
          );
          continue;
        }

        const metrics = await this.fetchMetrics(
          pub.platform,
          pub.externalPostId,
          account,
        );
        if (!metrics) continue;

        await this.publicationsRepo.update(pub.id, {
          likeCount: metrics.likeCount,
          commentCount: metrics.commentCount,
          shareCount: metrics.shareCount,
          viewCount: metrics.viewCount,
          engagementScore: computeEngagementScore(metrics),
          engagementSyncedAt: new Date(),
        });
        updated++;
      } catch (err) {
        this.logger.warn(
          `Engagement sync failed for ${pub.platform} ${
            pub.externalPostId
          }: ${summarizeAxiosError(err)}`,
        );
      }
    }
    return updated;
  }

  private async resolveAccount(
    pub: ContentPublications,
    tenantId: string,
    userId: string,
  ): Promise<SocialAccounts | null> {
    let account: SocialAccounts | null = null;

    if (pub.socialAccountId) {
      account = await this.socialRepo.findOne({
        where: { id: pub.socialAccountId },
      });
    }

    if (!account) {
      account =
        (await this.socialRepo.findOne({
          where: { tenantId, userId, platform: pub.platform, connected: true },
        })) ??
        (await this.socialRepo.findOne({
          where: { tenantId, platform: pub.platform, connected: true },
        }));
    }

    if (!account?.connected) return null;

    return this.publishAccounts.prepareAccount(account);
  }

  private async fetchMetrics(
    platform: string,
    externalPostId: string,
    account: SocialAccounts,
  ): Promise<EngagementMetrics | null> {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return this.fetchFacebookMetrics(externalPostId, account);
      case 'instagram':
        return this.fetchInstagramMetrics(externalPostId, account);
      case 'youtube':
        return this.fetchYoutubeMetrics(externalPostId, account);
      case 'linkedin':
        return this.fetchLinkedInMetrics(externalPostId, account);
      case 'twitter':
      case 'x':
        return this.fetchTwitterMetrics(externalPostId, account);
      default:
        return null;
    }
  }

  private async fetchFacebookMetrics(
    postId: string,
    account: SocialAccounts,
  ): Promise<EngagementMetrics | null> {
    const token = this.publishAccounts.getFacebookPageToken(account);
    if (!token?.trim()) {
      this.logger.warn(
        `Facebook engagement sync skipped for post ${postId}: missing page access token — reconnect Facebook in Publisher Connect`,
      );
      return null;
    }

    const { data } = await axios.get(`${GRAPH_API}/${postId}`, {
      params: {
        access_token: token,
        fields: 'likes.summary(true),comments.summary(true),shares',
      },
    });
    return {
      likeCount: Number(data.likes?.summary?.total_count ?? 0),
      commentCount: Number(data.comments?.summary?.total_count ?? 0),
      shareCount: Number(data.shares?.count ?? 0),
      viewCount: 0,
    };
  }

  private async fetchInstagramMetrics(
    mediaId: string,
    account: SocialAccounts,
  ): Promise<EngagementMetrics | null> {
    const token = this.publishAccounts.getInstagramToken(account);
    if (!token?.trim()) {
      this.logger.warn(
        `Instagram engagement sync skipped for media ${mediaId}: missing page access token — reconnect Instagram in Publisher Connect`,
      );
      return null;
    }

    const { data } = await axios.get(`${GRAPH_API}/${mediaId}`, {
      params: {
        access_token: token,
        fields: 'like_count,comments_count',
      },
    });
    return {
      likeCount: Number(data.like_count ?? 0),
      commentCount: Number(data.comments_count ?? 0),
      shareCount: 0,
      viewCount: 0,
    };
  }

  private async fetchYoutubeMetrics(
    videoId: string,
    account: SocialAccounts,
  ): Promise<EngagementMetrics> {
    const auth = this.youtubePublish.oauthClient(account);
    const youtube = google.youtube({ version: 'v3', auth });
    const { data } = await youtube.videos.list({
      part: ['statistics'],
      id: [videoId],
    });
    const stats = data.items?.[0]?.statistics;
    return {
      likeCount: Number(stats?.likeCount ?? 0),
      commentCount: Number(stats?.commentCount ?? 0),
      shareCount: 0,
      viewCount: Number(stats?.viewCount ?? 0),
    };
  }

  private async fetchLinkedInMetrics(
    postUrn: string,
    account: SocialAccounts,
  ): Promise<EngagementMetrics | null> {
    const token = account.accessToken?.trim();
    if (!token) return null;

    try {
      const { data } = await axios.get(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(
          postUrn,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      );
      const likes = Number(data.likesSummary?.totalLikes ?? 0);
      const comments = Number(
        data.commentsSummary?.totalFirstLevelComments ?? 0,
      );
      return {
        likeCount: likes,
        commentCount: comments,
        shareCount: 0,
        viewCount: 0,
      };
    } catch {
      return null;
    }
  }

  private async fetchTwitterMetrics(
    tweetId: string,
    account: SocialAccounts,
  ): Promise<EngagementMetrics | null> {
    const token = account.accessToken?.trim();
    if (!token) return null;

    try {
      const { data } = await axios.get(
        `https://api.twitter.com/2/tweets/${encodeURIComponent(tweetId)}`,
        {
          params: { 'tweet.fields': 'public_metrics' },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const metrics = data?.data?.public_metrics;
      if (!metrics) return null;

      return {
        likeCount: Number(metrics.like_count ?? 0),
        commentCount: Number(metrics.reply_count ?? 0),
        shareCount: Number(metrics.retweet_count ?? 0),
        viewCount: Number(metrics.impression_count ?? 0),
      };
    } catch {
      return null;
    }
  }
}
