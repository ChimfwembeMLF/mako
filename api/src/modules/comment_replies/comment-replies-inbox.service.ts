import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CommentReplies } from './entities/comment_replies.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { capabilityOf } from '../../constants/platform-capabilities';
import { scopeWhere } from '../../common/workspace-scope.util';

export type CommentInboxNode = {
  id: string;
  externalCommentId: string;
  parentCommentId: string | null;
  commenterName: string;
  commenterAvatarUrl: string | null;
  commentText: string;
  replyText: string | null;
  replyType: string | null;
  status: string;
  likeCount: number;
  isFromBrand: boolean;
  attachments: Array<{ url?: string; type?: string; name?: string }>;
  reactions: Array<{ type: string; count?: number }>;
  created_at: string;
  children: CommentInboxNode[];
};

export type PostInboxGroup = {
  key: string;
  contentId: string;
  platform: string;
  externalPostId: string;
  postTitle: string;
  postContent: string;
  postMedia: Array<{ url: string; type?: string; name?: string }>;
  publishedAt: string | null;
  brandPageName: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  engagementScore: number;
  pendingCount: number;
  totalComments: number;
  comments: CommentInboxNode[];
  /** False when the platform cannot sync comments via standard OAuth (e.g. LinkedIn). */
  commentSyncSupported: boolean;
  commentSyncNote?: string;
};

@Injectable()
export class CommentRepliesInboxService {
  constructor(
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
  ) {}

  async getInbox(
    tenantId: string,
    contentId?: string,
    workspaceId?: string,
  ): Promise<{ posts: PostInboxGroup[] }> {
    const workspaceContentIds = workspaceId
      ? (
          await this.contentRepo.find({
            where: { tenantId, workspaceId },
            select: ['id'],
          })
        ).map((c) => c.id)
      : null;

    if (workspaceId && workspaceContentIds?.length === 0) {
      return { posts: [] };
    }

    const comments = await this.commentsRepo.find({
      where: contentId
        ? { tenantId, contentId }
        : workspaceContentIds
        ? { tenantId, contentId: In(workspaceContentIds) }
        : { tenantId },
      order: { created_at: 'ASC' },
    });

    const publications = await this.publicationsRepo.find({
      where: contentId
        ? { tenantId, contentId, status: 'published' }
        : {
            ...scopeWhere<ContentPublications>(tenantId, workspaceId),
            status: 'published',
          },
      order: { publishedAt: 'DESC' },
    });

    const contentIds = [
      ...new Set([
        ...comments.map((c) => c.contentId),
        ...publications.map((p) => p.contentId),
      ]),
    ].filter((id) => !workspaceContentIds || workspaceContentIds.includes(id));
    const contents = contentIds.length
      ? await this.contentRepo.find({ where: { id: In(contentIds) } })
      : [];
    const contentById = new Map(contents.map((c) => [c.id, c]));

    const pubByPostKey = new Map<string, ContentPublications>();
    for (const pub of publications) {
      if (!pub.externalPostId) continue;
      const key = `${pub.contentId}:${pub.platform}:${pub.externalPostId}`;
      if (!pubByPostKey.has(key)) pubByPostKey.set(key, pub);
    }

    const grouped = new Map<string, CommentReplies[]>();
    for (const comment of comments) {
      const key = `${comment.contentId}:${comment.platform}:${comment.externalPostId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(comment);
    }

    const posts: PostInboxGroup[] = [];
    const seenKeys = new Set<string>();

    for (const [key, groupComments] of grouped) {
      seenKeys.add(key);
      const sample = groupComments[0];
      const pub = pubByPostKey.get(key);
      posts.push(
        await this.buildPostGroup({
          key,
          contentId: sample.contentId,
          platform: sample.platform,
          externalPostId: sample.externalPostId,
          pub,
          content: contentById.get(sample.contentId),
          groupComments,
        }),
      );
    }

    for (const pub of publications) {
      if (!pub.externalPostId) continue;
      const key = `${pub.contentId}:${pub.platform}:${pub.externalPostId}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      posts.push(
        await this.buildPostGroup({
          key,
          contentId: pub.contentId,
          platform: pub.platform,
          externalPostId: pub.externalPostId,
          pub,
          content: contentById.get(pub.contentId),
          groupComments: [],
        }),
      );
    }

    posts.sort((a, b) => {
      const aTime = a.comments.length
        ? latestActivity(a.comments)
        : a.publishedAt
        ? new Date(a.publishedAt).getTime()
        : 0;
      const bTime = b.comments.length
        ? latestActivity(b.comments)
        : b.publishedAt
        ? new Date(b.publishedAt).getTime()
        : 0;
      return bTime - aTime;
    });

    return { posts };
  }

  private async buildPostGroup(params: {
    key: string;
    contentId: string;
    platform: string;
    externalPostId: string;
    pub?: ContentPublications;
    content?: ContentItems;
    groupComments: CommentReplies[];
  }): Promise<PostInboxGroup> {
    const cap = capabilityOf(params.platform);
    const commentSyncSupported = cap?.comments ?? false;

    const postTitle =
      params.pub?.publishedTitle?.trim() ||
      params.content?.title?.trim() ||
      'Published post';
    const postContent = stripHtml(
      params.pub?.publishedContent ?? params.content?.content ?? '',
    );

    let brandPageName: string | null = null;
    if (params.pub?.socialAccountId) {
      const account = await this.socialRepo.findOne({
        where: { id: params.pub.socialAccountId },
      });
      brandPageName = account?.accountName ?? null;
    }

    return {
      key: params.key,
      contentId: params.contentId,
      platform: params.platform,
      externalPostId: params.externalPostId,
      postTitle,
      postContent: postContent.slice(0, 500),
      postMedia: params.pub?.publishedMedia ?? [],
      publishedAt: params.pub?.publishedAt?.toISOString() ?? null,
      brandPageName,
      likeCount: params.pub?.likeCount ?? 0,
      commentCount: params.pub?.commentCount ?? params.groupComments.length,
      shareCount: params.pub?.shareCount ?? 0,
      viewCount: params.pub?.viewCount ?? 0,
      engagementScore: params.pub?.engagementScore ?? 0,
      pendingCount: params.groupComments.filter((c) => c.status === 'pending')
        .length,
      totalComments: params.groupComments.length,
      comments: buildCommentTree(params.groupComments),
      commentSyncSupported,
      commentSyncNote: commentSyncSupported
        ? undefined
        : cap?.notes ??
          'Comment sync is not available for this platform with the current connection.',
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function latestActivity(nodes: CommentInboxNode[]): number {
  let max = 0;
  const walk = (list: CommentInboxNode[]) => {
    for (const n of list) {
      const t = new Date(n.created_at).getTime();
      if (t > max) max = t;
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return max;
}

function buildCommentTree(rows: CommentReplies[]): CommentInboxNode[] {
  const nodes = new Map<string, CommentInboxNode>();
  const roots: CommentInboxNode[] = [];

  for (const row of rows) {
    nodes.set(row.externalCommentId, {
      id: row.id,
      externalCommentId: row.externalCommentId,
      parentCommentId: row.parentCommentId ?? null,
      commenterName: row.commenterName,
      commenterAvatarUrl: row.commenterAvatarUrl ?? null,
      commentText: row.commentText,
      replyText: row.replyText ?? null,
      replyType: row.replyType ?? null,
      status: row.status ?? 'pending',
      likeCount: row.likeCount ?? 0,
      isFromBrand: row.isFromBrand ?? false,
      attachments: row.attachments ?? [],
      reactions: row.reactions ?? [],
      created_at: row.created_at.toISOString(),
      children: [],
    });
  }

  for (const row of rows) {
    const node = nodes.get(row.externalCommentId)!;
    const parentId = row.parentCommentId?.trim();
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: CommentInboxNode[]) => {
    list.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);
  dedupeSyncedBrandReplies(roots);

  return roots;
}

/** Drop brand child rows that duplicate the parent's stored replyText */
function dedupeSyncedBrandReplies(nodes: CommentInboxNode[]): void {
  for (const node of nodes) {
    const parentReply = node.replyText?.trim();
    if (parentReply) {
      node.children = node.children.filter((child) => {
        if (!child.isFromBrand) return true;
        const childBody = (child.replyText ?? child.commentText ?? '').trim();
        return childBody !== parentReply;
      });
    }
    dedupeSyncedBrandReplies(node.children);
  }
}
