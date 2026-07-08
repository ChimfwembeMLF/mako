import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { google } from 'googleapis';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { YoutubePublishingService } from './youtube-publishing.service';
import { SocialCommentAutoReplyService } from './social-comment-auto-reply.service';
import { PublicationEngagementService } from './publication-engagement.service';
import { SocialPublishAccountService } from './social-publish-account.service';
import { summarizeAxiosError } from './publish-error.util';
import { logOnce } from '../../common/throttled-log.util';
import { scopeWhere } from '../../common/workspace-scope.util';

type FetchedComment = {
  externalCommentId: string;
  externalPostId: string;
  commenterName: string;
  commenterAvatarUrl?: string;
  commentText: string;
  parentCommentId?: string;
  likeCount?: number;
  isFromBrand?: boolean;
};

@Injectable()
export class FetchCommentsService {
  private readonly logger = new Logger(FetchCommentsService.name);

  constructor(
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    private readonly youtubePublish: YoutubePublishingService,
    private readonly autoReply: SocialCommentAutoReplyService,
    private readonly engagement: PublicationEngagementService,
    private readonly publishAccounts: SocialPublishAccountService,
    private readonly config: ConfigService,
  ) {}

  async fetchForTenant(params: {
    tenantId: string;
    userId: string;
    workspaceId?: string;
    runAutoReply?: boolean;
  }): Promise<{
    fetched: number;
    autoReplied: number;
    engagementSynced: number;
  }> {
    const publications = await this.publicationsRepo.find({
      where: {
        ...scopeWhere<ContentPublications>(params.tenantId, params.workspaceId),
        status: 'published',
      },
      order: { publishedAt: 'DESC' },
    });

    const latestByPlatform = new Map<string, ContentPublications>();
    for (const pub of publications) {
      if (!pub.externalPostId) continue;
      const key = `${pub.contentId}:${pub.platform}`;
      if (!latestByPlatform.has(key)) latestByPlatform.set(key, pub);
    }

    let fetched = 0;
    const newCommentIds: string[] = [];
    for (const pub of latestByPlatform.values()) {
      try {
        const comments = await this.pullComments(pub, params.userId);
        for (const c of comments) {
          const exists = await this.commentsRepo.findOne({
            where: {
              tenantId: params.tenantId,
              externalCommentId: c.externalCommentId,
            },
          });
          if (exists) {
            await this.reconcileBrandClassification(exists, c);
            continue;
          }

          const saved = await this.commentsRepo.save(
            this.commentsRepo.create({
              tenantId: params.tenantId,
              contentId: pub.contentId,
              platform: pub.platform,
              externalCommentId: c.externalCommentId,
              externalPostId: c.externalPostId,
              commenterName: c.commenterName,
              commenterAvatarUrl: c.commenterAvatarUrl,
              commentText: c.commentText,
              parentCommentId: c.parentCommentId,
              likeCount: c.likeCount ?? 0,
              isFromBrand: c.isFromBrand ?? false,
              status: c.isFromBrand ? 'sent' : 'pending',
            }),
          );
          fetched++;
          newCommentIds.push(saved.id);
        }
      } catch (err) {
        logOnce(
          this.logger,
          'debug',
          `comment-fetch:${pub.platform}:${pub.externalPostId}`,
          `Comment fetch failed for ${pub.platform} post ${
            pub.externalPostId
          }: ${summarizeAxiosError(err)}`,
        );
      }
    }

    let autoReplied = 0;
    if (params.runAutoReply !== false) {
      if (newCommentIds.length) {
        const result = await this.autoReply.processNewComments(
          newCommentIds,
          params.userId,
        );
        autoReplied += result.sent;
      }
      // Backlog: threaded / older pending comments (e.g. after enabling rules)
      const backlog = await this.autoReply.processPendingForTenant(
        params.tenantId,
        params.userId,
        params.workspaceId,
      );
      autoReplied += backlog.sent;
    }

    const engagementSynced = await this.engagement.syncForTenant(
      params.tenantId,
      params.userId,
      params.workspaceId,
    );

    return { fetched, autoReplied, engagementSynced };
  }

  /** Sync comments for every tenant with published posts (cron). */
  async fetchAllTenants(): Promise<{
    fetched: number;
    tenants: number;
    autoReplied: number;
  }> {
    const pubs = await this.publicationsRepo.find({
      where: { status: 'published' },
      order: { publishedAt: 'DESC' },
    });

    const tenantUsers = new Map<string, string>();
    for (const pub of pubs) {
      if (!pub.externalPostId || tenantUsers.has(pub.tenantId)) continue;
      tenantUsers.set(pub.tenantId, pub.userId);
    }

    let fetched = 0;
    let autoReplied = 0;
    let tenants = 0;
    const delayMs = Number(
      this.config.get('COMMENT_SYNC_TENANT_DELAY_MS') ?? 300,
    );

    for (const [tenantId, userId] of tenantUsers) {
      const result = await this.fetchForTenant({
        tenantId,
        userId,
        runAutoReply: true,
      });
      fetched += result.fetched;
      autoReplied += result.autoReplied;
      tenants++;
      if (delayMs > 0) {
        await this.sleep(delayMs);
      }
    }

    return { fetched, tenants, autoReplied };
  }

  /** @deprecated Use fetchAllTenants — kept for compatibility */
  async fetchAllWithRateLimit(
    lastRunByTenant: Map<string, number>,
    minIntervalMs: number,
  ): Promise<{ fetched: number; tenants: number }> {
    void lastRunByTenant;
    void minIntervalMs;
    const result = await this.fetchAllTenants();
    return { fetched: result.fetched, tenants: result.tenants };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pullComments(
    pub: ContentPublications,
    userId: string,
  ): Promise<FetchedComment[]> {
    let account: SocialAccounts | null = null;

    if (pub.socialAccountId) {
      account = await this.socialRepo.findOne({
        where: { id: pub.socialAccountId },
      });
    }

    if (!account) {
      account =
        (await this.socialRepo.findOne({
          where: {
            tenantId: pub.tenantId,
            userId,
            platform: pub.platform,
            connected: true,
          },
        })) ??
        (await this.socialRepo.findOne({
          where: {
            tenantId: pub.tenantId,
            platform: pub.platform,
            connected: true,
          },
        }));
    }

    if (!account?.connected) return [];
    if (this.hasRecentAuthFailure(account)) return [];

    account = await this.publishAccounts.prepareAccount(account);
    if (!account.connected) return [];

    switch (pub.platform.toLowerCase()) {
      case 'facebook':
        return this.fetchFacebookComments(pub.externalPostId!, account);
      case 'instagram':
        return this.fetchInstagramComments(pub.externalPostId!, account);
      case 'linkedin':
        return this.fetchLinkedInComments(pub.externalPostId!, account);
      case 'youtube':
        return this.fetchYoutubeComments(pub.externalPostId!, account);
      default:
        return [];
    }
  }

  private async fetchFacebookComments(
    postId: string,
    account: SocialAccounts,
  ): Promise<FetchedComment[]> {
    const token = this.publishAccounts.getFacebookPageToken(account);
    if (!token?.trim()) {
      logOnce(
        this.logger,
        'debug',
        `fb-token:${account.id}`,
        `Facebook comment fetch skipped: missing page token (${account.id})`,
      );
      return [];
    }

    const res = await axios.get(
      `https://graph.facebook.com/v19.0/${postId}/comments`,
      {
        params: {
          access_token: token,
          fields:
            'id,message,from,created_time,like_count,comments{id,message,from,created_time,like_count}',
          limit: 50,
        },
      },
    );

    const out: FetchedComment[] = [];
    for (const c of res.data?.data ?? []) {
      const from = c.from as { name?: string; id?: string } | undefined;
      out.push({
        externalCommentId: String(c.id),
        externalPostId: postId,
        commenterName: String(from?.name ?? 'Facebook user'),
        commentText: String(c.message ?? ''),
        likeCount: Number(c.like_count ?? 0),
        isFromBrand: this.isBrandComment(account, from?.name, from?.id),
      });
      for (const reply of (c.comments as { data?: Record<string, unknown>[] })
        ?.data ?? []) {
        const replyFrom = reply.from as
          | { name?: string; id?: string }
          | undefined;
        out.push({
          externalCommentId: String(reply.id),
          externalPostId: postId,
          commenterName: String(replyFrom?.name ?? 'Facebook user'),
          commentText: String(reply.message ?? ''),
          parentCommentId: String(c.id),
          likeCount: Number(reply.like_count ?? 0),
          isFromBrand: this.isBrandComment(
            account,
            replyFrom?.name,
            replyFrom?.id,
          ),
        });
      }
    }
    return out;
  }

  private async fetchInstagramComments(
    mediaId: string,
    account: SocialAccounts,
  ): Promise<FetchedComment[]> {
    const token = this.publishAccounts.getInstagramToken(account);
    if (!token?.trim()) {
      logOnce(
        this.logger,
        'debug',
        `ig-token:${account.id}`,
        `Instagram comment fetch skipped: missing page token (${account.id})`,
      );
      return [];
    }

    const res = await axios.get(
      `https://graph.facebook.com/v19.0/${mediaId}/comments`,
      {
        params: {
          access_token: token,
          fields:
            'id,text,username,from,timestamp,like_count,replies{id,text,username,from,timestamp,like_count}',
          limit: 50,
        },
      },
    );

    const out: FetchedComment[] = [];
    for (const c of res.data?.data ?? []) {
      const from = c.from as { id?: string; username?: string } | undefined;
      const commenterName = String(
        from?.username ?? c.username ?? 'Instagram user',
      );
      out.push({
        externalCommentId: String(c.id),
        externalPostId: mediaId,
        commenterName,
        commentText: String(c.text ?? ''),
        likeCount: Number(c.like_count ?? 0),
        isFromBrand: this.isBrandComment(account, commenterName, from?.id),
      });
      for (const reply of (c.replies as { data?: Record<string, unknown>[] })
        ?.data ?? []) {
        const replyFrom = reply.from as
          | { id?: string; username?: string }
          | undefined;
        const replyName = String(
          replyFrom?.username ?? reply.username ?? 'Instagram user',
        );
        out.push({
          externalCommentId: String(reply.id),
          externalPostId: mediaId,
          commenterName: replyName,
          commentText: String(reply.text ?? ''),
          parentCommentId: String(c.id),
          likeCount: Number(reply.like_count ?? 0),
          isFromBrand: this.isBrandComment(account, replyName, replyFrom?.id),
        });
      }
    }
    return out;
  }

  private async fetchLinkedInComments(
    postUrn: string,
    account: SocialAccounts,
  ): Promise<FetchedComment[]> {
    const token = account.accessToken;
    if (!token) return [];

    try {
      const res = await axios.get(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(
          postUrn,
        )}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          params: { count: 50 },
        },
      );

      const elements = res.data?.elements ?? [];
      return elements.map((c: Record<string, unknown>) => {
        const actor = c.actor as string | undefined;
        const message = c.message as { text?: string } | undefined;
        return {
          externalCommentId: String(c.id ?? c.$URN ?? ''),
          externalPostId: postUrn,
          commenterName:
            actor?.replace('urn:li:person:', 'LinkedIn user ') ??
            'LinkedIn user',
          commentText: String(message?.text ?? ''),
        };
      });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const liMessage =
        axios.isAxiosError(err) &&
        (err.response?.data as { message?: string; status?: number })?.message;
      logOnce(
        this.logger,
        'debug',
        `li-comments:${account.id}`,
        `LinkedIn comment fetch failed (${status ?? 'error'}): ${
          liMessage ??
          'requires r_member_social — LinkedIn only grants this to Marketing API / partner-approved apps.'
        }`,
      );
      return [];
    }
  }

  private async fetchYoutubeComments(
    videoId: string,
    account: SocialAccounts,
  ): Promise<FetchedComment[]> {
    try {
      const auth = this.youtubePublish.oauthClient(account);
      const youtube = google.youtube({ version: 'v3', auth });
      const { data } = await youtube.commentThreads.list({
        part: ['snippet', 'replies'],
        videoId,
        maxResults: 50,
        order: 'time',
      });

      const out: FetchedComment[] = [];
      for (const thread of data.items ?? []) {
        const topComment = thread.snippet?.topLevelComment;
        const top = topComment?.snippet;
        const topId = String(topComment?.id ?? thread.id ?? '');
        out.push({
          externalCommentId: topId,
          externalPostId: videoId,
          commenterName: top?.authorDisplayName ?? 'YouTube user',
          commenterAvatarUrl: top?.authorProfileImageUrl,
          commentText: String(top?.textDisplay ?? top?.textOriginal ?? ''),
          likeCount: Number(top?.likeCount ?? 0),
          isFromBrand: this.isBrandComment(
            account,
            top?.authorDisplayName,
            this.youtubeChannelId(top?.authorChannelId),
          ),
        });

        for (const reply of thread.replies?.comments ?? []) {
          const rs = reply.snippet;
          out.push({
            externalCommentId: String(reply.id ?? ''),
            externalPostId: videoId,
            commenterName: rs?.authorDisplayName ?? 'YouTube user',
            commenterAvatarUrl: rs?.authorProfileImageUrl,
            commentText: String(rs?.textDisplay ?? rs?.textOriginal ?? ''),
            parentCommentId: topId,
            likeCount: Number(rs?.likeCount ?? 0),
            isFromBrand: this.isBrandComment(
              account,
              rs?.authorDisplayName,
              this.youtubeChannelId(rs?.authorChannelId),
            ),
          });
        }
      }
      return out;
    } catch (err) {
      logOnce(
        this.logger,
        'debug',
        `yt-comments:${account.id}`,
        `YouTube comment fetch failed: ${summarizeAxiosError(err)}`,
      );
      return [];
    }
  }

  private hasRecentAuthFailure(account: SocialAccounts): boolean {
    const at = account.metadata?.auth_error_at;
    if (!at || typeof at !== 'string') return false;
    const age = Date.now() - new Date(at).getTime();
    return age >= 0 && age < 24 * 60 * 60 * 1000;
  }

  private youtubeChannelId(
    raw: string | { value?: string } | null | undefined,
  ): string | undefined {
    if (!raw) return undefined;
    if (typeof raw === 'string') return raw;
    return raw.value;
  }

  /**
   * Detect page/channel-authored comments. Never treat OAuth user personal profile
   * names as the brand (account.username on Facebook is the connecting user, not the Page).
   */
  private isBrandComment(
    account: SocialAccounts,
    fromName?: string,
    fromId?: string,
  ): boolean {
    const meta = account.metadata ?? {};
    const platform = account.platform.toLowerCase();

    const brandIds = [
      meta.page_id,
      meta.instagram_business_account_id,
      (meta.profile as { id?: string } | undefined)?.id,
      account.externalId,
    ]
      .filter(Boolean)
      .map(String);

    if (fromId && brandIds.includes(String(fromId))) {
      return true;
    }

    const brandNames: string[] = [];
    if (account.accountName) brandNames.push(account.accountName);
    if (meta.page_name) brandNames.push(String(meta.page_name));
    // Instagram username is the business handle; Facebook username is the personal profile — omit it
    if (platform === 'instagram' && account.username) {
      brandNames.push(account.username);
    }

    const normalized = fromName?.trim().toLowerCase();
    if (!normalized || brandNames.length === 0) return false;

    return brandNames.some((n) => n.toLowerCase() === normalized);
  }

  /** Fix rows misclassified before brand detection used page IDs only. */
  private async reconcileBrandClassification(
    existing: CommentReplies,
    fetched: FetchedComment,
  ): Promise<void> {
    const shouldBeBrand = fetched.isFromBrand ?? false;
    if (existing.isFromBrand === shouldBeBrand) return;

    const patch: Partial<CommentReplies> = { isFromBrand: shouldBeBrand };

    if (shouldBeBrand) {
      patch.status = 'sent';
    } else if (!existing.replyText?.trim()) {
      // Was wrongly marked as brand — reopen for replies / auto-reply
      patch.status = 'pending';
    }

    await this.commentsRepo.update(existing.id, patch);
  }
}
