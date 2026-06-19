import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappMessages } from '../whatsapp/entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { SocialMessages } from './entities/social_messages.entity';
import { CommentRepliesInboxService } from '../comment_replies/comment-replies-inbox.service';
import { scopeWhere } from '../../common/workspace-scope.util';

export type UnifiedConversation = {
  id: string;
  channel: 'post_comment' | 'dm';
  platform: string;
  title: string;
  preview: string;
  lastAt: string;
  unreadCount: number;
  pendingCount: number;
  participantName?: string | null;
  participantAvatarUrl?: string | null;
  contentId?: string;
  threadId?: string;
  phone?: string;
  postKey?: string;
};

export type UnifiedMessage = {
  id: string;
  channel: 'post_comment' | 'dm' | 'whatsapp';
  platform: string;
  direction: 'inbound' | 'outbound';
  body: string;
  attachments: Array<{ url?: string; type?: string; name?: string }>;
  reactions: Array<{ type: string; count?: number }>;
  status: string;
  isFromBrand?: boolean;
  authorName?: string;
  authorAvatarUrl?: string | null;
  created_at: string;
  commentNode?: unknown;
};

@Injectable()
export class UnifiedInboxService {
  constructor(
    @InjectRepository(WhatsappMessages)
    private readonly waRepo: Repository<WhatsappMessages>,
    @InjectRepository(SocialMessages)
    private readonly socialRepo: Repository<SocialMessages>,
    private readonly commentInbox: CommentRepliesInboxService,
    private readonly waMessaging: WhatsappMessagingService,
  ) {}

  async listConversations(
    tenantId: string,
    channel?: 'post_comment' | 'dm' | 'all',
    workspaceId?: string,
  ): Promise<UnifiedConversation[]> {
    const conversations: UnifiedConversation[] = [];

    if (!channel || channel === 'all' || channel === 'post_comment') {
      const { posts } = await this.commentInbox.getInbox(
        tenantId,
        undefined,
        workspaceId,
      );
      for (const post of posts) {
        const latest = this.latestCommentTime(post.comments);
        conversations.push({
          id: `post:${post.key}`,
          channel: 'post_comment',
          platform: post.platform,
          title: post.postTitle,
          preview:
            post.postContent.slice(0, 120) || `${post.totalComments} comments`,
          lastAt: latest ?? post.publishedAt ?? new Date().toISOString(),
          unreadCount: post.pendingCount,
          pendingCount: post.pendingCount,
          contentId: post.contentId,
          postKey: post.key,
        });
      }
    }

    if (!channel || channel === 'all' || channel === 'dm') {
      conversations.push(
        ...(await this.dmConversations(tenantId, 'whatsapp', workspaceId)),
      );
      conversations.push(
        ...(await this.dmConversations(tenantId, 'facebook', workspaceId)),
      );
      conversations.push(
        ...(await this.dmConversations(tenantId, 'instagram', workspaceId)),
      );
    }

    conversations.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
    return conversations;
  }

  async listMessages(
    tenantId: string,
    conversationId: string,
    workspaceId?: string,
  ): Promise<UnifiedMessage[]> {
    if (conversationId.startsWith('post:')) {
      return [];
    }
    if (conversationId.startsWith('wa:')) {
      const phone = this.waMessaging.normalizePhone(conversationId.slice(3));
      const rows = await this.waRepo.find({
        where: {
          ...scopeWhere<WhatsappMessages>(tenantId, workspaceId),
          phone,
        },
        order: { created_at: 'ASC' },
        take: 200,
      });
      return rows.map((m) => ({
        id: m.id,
        channel: 'whatsapp' as const,
        platform: 'whatsapp',
        direction: m.direction,
        body: m.body,
        attachments: m.attachments ?? [],
        reactions: m.reactions ?? [],
        status: m.status,
        created_at: m.created_at.toISOString(),
      }));
    }

    const [, platform, threadId] = conversationId.split(':');
    if (!platform || !threadId) return [];

    const rows = await this.socialRepo.find({
      where: {
        ...scopeWhere<SocialMessages>(tenantId, workspaceId),
        platform,
        threadId,
      },
      order: { created_at: 'ASC' },
      take: 200,
    });
    return rows.map((m) => ({
      id: m.id,
      channel: 'dm',
      platform: m.platform,
      direction: m.direction,
      body: m.body,
      attachments: m.attachments ?? [],
      reactions: m.reactions ?? [],
      status: m.status,
      authorName: m.participantName,
      authorAvatarUrl: m.participantAvatarUrl,
      created_at: m.created_at.toISOString(),
    }));
  }

  private async dmConversations(
    tenantId: string,
    platform: string,
    workspaceId?: string,
  ): Promise<UnifiedConversation[]> {
    if (platform === 'whatsapp') {
      const qb = this.waRepo
        .createQueryBuilder('m')
        .select('m.phone', 'phone')
        .addSelect('MAX(m.created_at)', 'last_at')
        .addSelect(
          `(array_agg(m.body ORDER BY m.created_at DESC))[1]`,
          'preview',
        )
        .addSelect(
          `SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END)`,
          'inbound_count',
        )
        .where('m.tenantId = :tenantId', { tenantId });

      if (workspaceId) {
        qb.andWhere('m.workspaceId = :workspaceId', { workspaceId });
      }

      const rows = await qb
        .groupBy('m.phone')
        .orderBy('last_at', 'DESC')
        .getRawMany<{
          phone: string;
          last_at: Date;
          preview: string;
          inbound_count: string;
        }>();

      return rows.map((r) => ({
        id: `wa:${r.phone}`,
        channel: 'dm' as const,
        platform: 'whatsapp',
        title: r.phone,
        preview: r.preview ?? '',
        lastAt: new Date(r.last_at).toISOString(),
        unreadCount: Number(r.inbound_count ?? 0),
        pendingCount: 0,
        phone: r.phone,
        participantName: r.phone,
      }));
    }

    const socialQb = this.socialRepo
      .createQueryBuilder('m')
      .select('m.threadId', 'thread_id')
      .addSelect('m.platform', 'platform')
      .addSelect('MAX(m.participantName)', 'participant_name')
      .addSelect('MAX(m.participantAvatarUrl)', 'participant_avatar_url')
      .addSelect('MAX(m.created_at)', 'last_at')
      .addSelect(`(array_agg(m.body ORDER BY m.created_at DESC))[1]`, 'preview')
      .addSelect(
        `SUM(CASE WHEN m.direction = 'inbound' AND m.status = 'received' THEN 1 ELSE 0 END)`,
        'unread_count',
      )
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.platform = :platform', { platform });

    if (workspaceId) {
      socialQb.andWhere('m.workspaceId = :workspaceId', { workspaceId });
    }

    const rows = await socialQb
      .groupBy('m.threadId')
      .addGroupBy('m.platform')
      .orderBy('last_at', 'DESC')
      .getRawMany<{
        thread_id: string;
        platform: string;
        participant_name: string;
        participant_avatar_url: string;
        last_at: Date;
        preview: string;
        unread_count: string;
      }>();

    return rows.map((r) => ({
      id: `dm:${r.platform}:${r.thread_id}`,
      channel: 'dm' as const,
      platform: r.platform,
      title: r.participant_name || `${r.platform} conversation`,
      preview: r.preview ?? '',
      lastAt: new Date(r.last_at).toISOString(),
      unreadCount: Number(r.unread_count ?? 0),
      pendingCount: 0,
      threadId: r.thread_id,
      participantName: r.participant_name,
      participantAvatarUrl: r.participant_avatar_url,
    }));
  }

  private latestCommentTime(
    nodes: Array<{ created_at: string; children: unknown[] }>,
  ): string | null {
    let max = 0;
    const walk = (list: Array<{ created_at: string; children: unknown[] }>) => {
      for (const n of list) {
        const t = new Date(n.created_at).getTime();
        if (t > max) max = t;
        walk(n.children as Array<{ created_at: string; children: unknown[] }>);
      }
    };
    walk(nodes);
    return max ? new Date(max).toISOString() : null;
  }
}
