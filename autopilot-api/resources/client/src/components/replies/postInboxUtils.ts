import type { PostInboxGroup } from '@/lib/api';
import type { PlatformPayload } from '@/lib/platforms';

function isVideoMedia(item: { type?: string; url?: string }): boolean {
  return Boolean(
    item.type?.startsWith('video') || item.url?.match(/\.(mp4|webm|mov|m4v)(\?|$)/i),
  );
}

export function postToPlatformPayload(post: Pick<PostInboxGroup, 'postContent' | 'postTitle' | 'postMedia'>): PlatformPayload {
  return {
    content: post.postContent,
    title: post.postTitle,
    media: (post.postMedia ?? [])
      .filter((m) => m.url)
      .map((m) => ({
        url: m.url,
        type: isVideoMedia(m) ? 'video' as const : 'image' as const,
        name: m.name,
      })),
  };
}

export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

type PublicationLike = {
  id: string;
  platform: string;
  status: string;
  publishedContent: string;
  publishedTitle?: string;
  publishedMedia?: Array<{ url: string; type?: string; name?: string }>;
  externalPostId?: string;
  publishedAt?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  viewCount?: number;
  engagementScore?: number;
};

export function mergePublicationWithInbox(
  pub: PublicationLike,
  contentId: string,
  fallbackTitle: string,
  inboxPosts: PostInboxGroup[],
): PostInboxGroup {
  const match = inboxPosts.find(
    (p) =>
      p.platform === pub.platform &&
      (!pub.externalPostId || p.externalPostId === pub.externalPostId),
  );
  if (match) {
    return {
      ...match,
      postTitle: match.postTitle || pub.publishedTitle || fallbackTitle,
      postContent: match.postContent || plainText(pub.publishedContent),
      postMedia:
        match.postMedia?.length ? match.postMedia : (pub.publishedMedia ?? []),
      likeCount: match.likeCount || pub.likeCount || 0,
      commentCount: match.commentCount || pub.commentCount || 0,
      shareCount: match.shareCount || pub.shareCount || 0,
      viewCount: match.viewCount || pub.viewCount || 0,
      engagementScore: match.engagementScore || pub.engagementScore || 0,
      publishedAt: match.publishedAt || pub.publishedAt || null,
    };
  }

  const key = `${contentId}:${pub.platform}:${pub.externalPostId ?? pub.id}`;
  return {
    key,
    contentId,
    platform: pub.platform,
    externalPostId: pub.externalPostId ?? '',
    postTitle: pub.publishedTitle?.trim() || fallbackTitle,
    postContent: plainText(pub.publishedContent).slice(0, 2000),
    postMedia: pub.publishedMedia ?? [],
    publishedAt: pub.publishedAt ?? null,
    brandPageName: null,
    likeCount: pub.likeCount ?? 0,
    commentCount: pub.commentCount ?? 0,
    shareCount: pub.shareCount ?? 0,
    viewCount: pub.viewCount ?? 0,
    engagementScore: pub.engagementScore ?? 0,
    pendingCount: 0,
    totalComments: 0,
    comments: [],
  };
}
