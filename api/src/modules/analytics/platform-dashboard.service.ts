import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { SocialInsights } from './entities/social_insights.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import {
  applyWorkspaceScope,
  scopeWhereIncludingTenantWide,
} from '../../common/workspace-scope.util';

export const DASHBOARD_PLATFORMS: Array<{ id: string; label: string }> = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
];

export type PlatformDashboardRow = {
  platform: string;
  label: string;
  connected: boolean;
  accountCount: number;
  accountName?: string;
  username?: string;
  publishedPosts: number;
  scheduledPosts: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagementScore: number;
  followers: number;
  reach: number;
  impressions: number;
  pendingReplies: number;
  lastPublishedAt?: string;
  lastEngagementSync?: string;
};

export type PlatformDashboardResponse = {
  platforms: PlatformDashboardRow[];
  totals: {
    connectedPlatforms: number;
    publishedPosts: number;
    scheduledPosts: number;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    engagementScore: number;
    pendingReplies: number;
    followers: number;
    reach: number;
    impressions: number;
  };
};

type PubAgg = {
  platform: string;
  publishedPosts: string;
  likes: string;
  comments: string;
  shares: string;
  views: string;
  engagementScore: string;
  lastPublishedAt: Date | null;
  lastEngagementSync: Date | null;
};

function normalizePlatformId(platform: string): string {
  const key = platform.toLowerCase();
  if (key === 'x') return 'twitter';
  return key;
}

@Injectable()
export class PlatformDashboardService {
  constructor(
    @InjectRepository(SocialAccounts)
    private readonly accountsRepo: Repository<SocialAccounts>,
    @InjectRepository(ContentPublications)
    private readonly pubsRepo: Repository<ContentPublications>,
    @InjectRepository(SocialInsights)
    private readonly insightsRepo: Repository<SocialInsights>,
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
  ) {}

  async getDashboard(
    tenantId: string,
    workspaceId?: string,
  ): Promise<PlatformDashboardResponse> {
    const accounts = await this.accountsRepo.find({
      where: scopeWhereIncludingTenantWide<SocialAccounts>(tenantId, workspaceId, {
        connected: true,
      }),
      order: { updated_at: 'DESC' },
    });

    const pubQb = this.pubsRepo
      .createQueryBuilder('p')
      .select('p.platform', 'platform')
      .addSelect('COUNT(*)', 'publishedPosts')
      .addSelect('COALESCE(SUM(p.likeCount), 0)', 'likes')
      .addSelect('COALESCE(SUM(p.commentCount), 0)', 'comments')
      .addSelect('COALESCE(SUM(p.shareCount), 0)', 'shares')
      .addSelect('COALESCE(SUM(p.viewCount), 0)', 'views')
      .addSelect('COALESCE(SUM(p.engagementScore), 0)', 'engagementScore')
      .addSelect('MAX(p.publishedAt)', 'lastPublishedAt')
      .addSelect('MAX(p.engagementSyncedAt)', 'lastEngagementSync')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.status = :status', { status: 'published' });

    applyWorkspaceScope(pubQb, 'p', workspaceId);

    const pubAggs = (await pubQb.groupBy('p.platform').getRawMany()) as PubAgg[];
    const pubByPlatform = new Map(
      pubAggs.map((r) => [normalizePlatformId(r.platform), r]),
    );

    const pendingQb = this.commentsRepo
      .createQueryBuilder('c')
      .select('c.platform', 'platform')
      .addSelect('COUNT(*)', 'pendingReplies')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.status = :status', { status: 'pending' });

    if (workspaceId) {
      pendingQb
        .innerJoin(ContentItems, 'ci', 'ci.id = c.contentId')
        .andWhere('(ci.workspaceId = :workspaceId OR ci.workspaceId IS NULL)', {
          workspaceId,
        });
    }

    const pendingAggs = await pendingQb.groupBy('c.platform').getRawMany();
    const pendingByPlatform = new Map(
      pendingAggs.map((r) => [
        normalizePlatformId(r.platform),
        Number(r.pendingReplies ?? 0),
      ]),
    );

    const scheduledItems = await this.contentRepo.find({
      where: scopeWhereIncludingTenantWide<ContentItems>(tenantId, workspaceId, {
        status: In(['scheduled', 'approved']),
      }),
      select: ['platforms', 'scheduledDate'],
    });

    const scheduledByPlatform = new Map<string, number>();
    for (const item of scheduledItems) {
      if (!item.scheduledDate) continue;
      for (const p of item.platforms ?? []) {
        const key = normalizePlatformId(p);
        scheduledByPlatform.set(key, (scheduledByPlatform.get(key) ?? 0) + 1);
      }
    }

    const accountIds = accounts.map((a) => a.id);
    const insightsByAccount = new Map<string, SocialInsights>();
    if (accountIds.length) {
      const insights = await this.insightsRepo
        .createQueryBuilder('i')
        .where('i.socialAccountId IN (:...accountIds)', { accountIds })
        .orderBy('i.date', 'DESC')
        .getMany();
      for (const row of insights) {
        if (!insightsByAccount.has(row.socialAccountId)) {
          insightsByAccount.set(row.socialAccountId, row);
        }
      }
    }

    const accountsByPlatform = new Map<string, SocialAccounts[]>();
    for (const account of accounts) {
      const key = normalizePlatformId(account.platform);
      const list = accountsByPlatform.get(key) ?? [];
      list.push(account);
      accountsByPlatform.set(key, list);
    }

    const platforms: PlatformDashboardRow[] = DASHBOARD_PLATFORMS.map(({ id, label }) => {
      const platformAccounts = accountsByPlatform.get(id) ?? [];
      const pub = pubByPlatform.get(id);
      let followers = 0;
      let reach = 0;
      let impressions = 0;
      for (const acc of platformAccounts) {
        const insight = insightsByAccount.get(acc.id);
        if (insight) {
          followers += insight.followersCount ?? 0;
          reach += insight.reach ?? 0;
          impressions += insight.impressions ?? 0;
        }
      }
      const primary = platformAccounts[0];

      return {
        platform: id,
        label,
        connected: platformAccounts.length > 0,
        accountCount: platformAccounts.length,
        accountName: primary?.accountName,
        username: primary?.username ?? undefined,
        publishedPosts: Number(pub?.publishedPosts ?? 0),
        scheduledPosts: scheduledByPlatform.get(id) ?? 0,
        likes: Number(pub?.likes ?? 0),
        comments: Number(pub?.comments ?? 0),
        shares: Number(pub?.shares ?? 0),
        views: Number(pub?.views ?? 0),
        engagementScore: Number(pub?.engagementScore ?? 0),
        followers,
        reach,
        impressions,
        pendingReplies: pendingByPlatform.get(id) ?? 0,
        lastPublishedAt: pub?.lastPublishedAt
          ? new Date(pub.lastPublishedAt).toISOString()
          : undefined,
        lastEngagementSync: pub?.lastEngagementSync
          ? new Date(pub.lastEngagementSync).toISOString()
          : undefined,
      };
    });

    const totals = platforms.reduce(
      (acc, p) => ({
        connectedPlatforms: acc.connectedPlatforms + (p.connected ? 1 : 0),
        publishedPosts: acc.publishedPosts + p.publishedPosts,
        scheduledPosts: acc.scheduledPosts + p.scheduledPosts,
        likes: acc.likes + p.likes,
        comments: acc.comments + p.comments,
        shares: acc.shares + p.shares,
        views: acc.views + p.views,
        engagementScore: acc.engagementScore + p.engagementScore,
        pendingReplies: acc.pendingReplies + p.pendingReplies,
        followers: acc.followers + p.followers,
        reach: acc.reach + p.reach,
        impressions: acc.impressions + p.impressions,
      }),
      {
        connectedPlatforms: 0,
        publishedPosts: 0,
        scheduledPosts: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        engagementScore: 0,
        pendingReplies: 0,
        followers: 0,
        reach: 0,
        impressions: 0,
      },
    );

    return { platforms, totals };
  }
}
