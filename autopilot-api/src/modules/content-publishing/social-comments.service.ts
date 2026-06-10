import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';

type FetchedComment = {
  externalCommentId: string;
  externalPostId: string;
  commenterName: string;
  commenterAvatarUrl?: string;
  commentText: string;
  parentCommentId?: string;
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
  ) {}

  async fetchForTenant(params: { tenantId: string; userId: string }): Promise<{ fetched: number }> {
    const publications = await this.publicationsRepo.find({
      where: { tenantId: params.tenantId, status: 'published' },
      order: { publishedAt: 'DESC' },
    });

    const latestByPlatform = new Map<string, ContentPublications>();
    for (const pub of publications) {
      if (!pub.externalPostId) continue;
      const key = `${pub.contentId}:${pub.platform}`;
      if (!latestByPlatform.has(key)) latestByPlatform.set(key, pub);
    }

    let fetched = 0;
    for (const pub of latestByPlatform.values()) {
      try {
        const comments = await this.pullComments(pub, params.userId);
        for (const c of comments) {
          const exists = await this.commentsRepo.findOne({
            where: { tenantId: params.tenantId, externalCommentId: c.externalCommentId },
          });
          if (exists) continue;

          await this.commentsRepo.save(
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
              status: 'pending',
            }),
          );
          fetched++;
        }
      } catch (err) {
        this.logger.warn(`Comment fetch failed for ${pub.platform} post ${pub.externalPostId}`, err);
      }
    }

    return { fetched };
  }

  /** Sync comments for all tenants with published posts (cron / background) */
  async fetchAllWithRateLimit(
    lastRunByTenant: Map<string, number>,
    minIntervalMs: number,
  ): Promise<{ fetched: number; tenants: number }> {
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
    let tenants = 0;
    const now = Date.now();

    for (const [tenantId, userId] of tenantUsers) {
      const last = lastRunByTenant.get(tenantId) ?? 0;
      if (now - last < minIntervalMs) continue;

      lastRunByTenant.set(tenantId, now);
      const result = await this.fetchForTenant({ tenantId, userId });
      fetched += result.fetched;
      tenants++;
    }

    return { fetched, tenants };
  }

  private async pullComments(
    pub: ContentPublications,
    userId: string,
  ): Promise<FetchedComment[]> {
    const account = pub.socialAccountId
      ? await this.socialRepo.findOne({ where: { id: pub.socialAccountId } })
      : await this.socialRepo.findOne({
          where: { userId, platform: pub.platform, connected: true },
        });

    if (!account) return [];

    switch (pub.platform.toLowerCase()) {
      case 'facebook':
        return this.fetchFacebookComments(pub.externalPostId!, account);
      case 'instagram':
        return this.fetchInstagramComments(pub.externalPostId!, account);
      case 'linkedin':
        return this.fetchLinkedInComments(pub.externalPostId!, account);
      default:
        return [];
    }
  }

  private async fetchFacebookComments(
    postId: string,
    account: SocialAccounts,
  ): Promise<FetchedComment[]> {
    const token = account.metadata?.page_token ?? account.accessToken;
    if (!token) return [];

    const res = await axios.get(`https://graph.facebook.com/v19.0/${postId}/comments`, {
      params: {
        access_token: token,
        fields: 'id,message,from,created_time,parent',
        limit: 50,
      },
    });

    return (res.data?.data ?? []).map((c: Record<string, unknown>) => ({
      externalCommentId: String(c.id),
      externalPostId: postId,
      commenterName: String((c.from as { name?: string })?.name ?? 'Facebook user'),
      commentText: String(c.message ?? ''),
      parentCommentId: (c.parent as { id?: string })?.id,
    }));
  }

  private async fetchInstagramComments(
    mediaId: string,
    account: SocialAccounts,
  ): Promise<FetchedComment[]> {
    const token = account.accessToken;
    if (!token) return [];

    const res = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}/comments`, {
      params: {
        access_token: token,
        fields: 'id,text,username,timestamp',
        limit: 50,
      },
    });

    return (res.data?.data ?? []).map((c: Record<string, unknown>) => ({
      externalCommentId: String(c.id),
      externalPostId: mediaId,
      commenterName: String(c.username ?? 'Instagram user'),
      commentText: String(c.text ?? ''),
    }));
  }

  private async fetchLinkedInComments(
    postUrn: string,
    account: SocialAccounts,
  ): Promise<FetchedComment[]> {
    const token = account.accessToken;
    if (!token) return [];

    try {
      const res = await axios.get(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`,
        {
          headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' },
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
          commenterName: actor?.replace('urn:li:person:', 'LinkedIn user ') ?? 'LinkedIn user',
          commentText: String(message?.text ?? ''),
        };
      });
    } catch (err) {
      this.logger.warn('LinkedIn comment fetch requires r_member_social / partner access', err);
      return [];
    }
  }
}

@Injectable()
export class SendCommentReplyService {
  private readonly logger = new Logger(SendCommentReplyService.name);

  constructor(
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
  ) {}

  async sendReply(params: { commentReplyId: string; userId: string; message: string }) {
    const reply = await this.commentsRepo.findOne({ where: { id: params.commentReplyId } });
    if (!reply) throw new NotFoundException('Comment reply not found');

    const account = await this.socialRepo.findOne({
      where: { userId: params.userId, platform: reply.platform, connected: true },
    });
    if (!account) {
      throw new NotFoundException(`No connected ${reply.platform} account`);
    }

    const pub = await this.publicationsRepo.findOne({
      where: {
        contentId: reply.contentId,
        platform: reply.platform,
        externalPostId: reply.externalPostId,
        status: 'published',
      },
    });

    try {
      switch (reply.platform.toLowerCase()) {
        case 'facebook':
          await this.replyFacebook(reply.externalCommentId, params.message, account);
          break;
        case 'instagram':
          await this.replyInstagram(reply.externalCommentId, params.message, account);
          break;
        case 'linkedin':
          await this.replyLinkedIn(reply, params.message, account, pub?.externalPostId);
          break;
        default:
          throw new NotFoundException(`Replies not supported for ${reply.platform}`);
      }

      await this.commentsRepo.update(reply.id, {
        replyText: params.message,
        replyType: 'manual',
        status: 'sent',
        sentAt: new Date(),
      } as Partial<CommentReplies>);

      return { sent: true };
    } catch (err) {
      this.logger.error(`Failed to send reply on ${reply.platform}`, err);
      await this.commentsRepo.update(reply.id, { status: 'failed' } as Partial<CommentReplies>);
      throw err;
    }
  }

  private async replyFacebook(commentId: string, message: string, account: SocialAccounts) {
    const token = account.metadata?.page_token ?? account.accessToken;
    await axios.post(`https://graph.facebook.com/v19.0/${commentId}/comments`, {
      message,
      access_token: token,
    });
  }

  private async replyInstagram(commentId: string, message: string, account: SocialAccounts) {
    await axios.post(`https://graph.facebook.com/v19.0/${commentId}/replies`, {
      message,
      access_token: account.accessToken,
    });
  }

  private async replyLinkedIn(
    reply: CommentReplies,
    message: string,
    account: SocialAccounts,
    postUrn?: string,
  ) {
    const token = account.accessToken;
    const actor = account.metadata?.person_urn ?? account.externalId;
    if (!postUrn || !actor) {
      throw new NotFoundException('LinkedIn reply requires post URN and person URN');
    }

    await axios.post(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`,
      {
        actor,
        message: { text: message },
        object: postUrn,
        parentComment: reply.parentCommentId
          ? `urn:li:comment:(${postUrn},${reply.parentCommentId})`
          : undefined,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );
  }
}
