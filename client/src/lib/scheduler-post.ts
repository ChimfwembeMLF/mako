import type { PlatformPayload } from '@/lib/platforms';
import {
  getScheduleSortKey,
  isDueOrOverdue,
  isScheduledStatus,
  resolveScheduleDateStr,
} from '@/lib/schedule';

export interface ScheduledPost {
  id: string;
  content: string;
  content_type: string;
  platforms?: string[];
  title: string | null;
  status: string;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  campaign_theme: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_failed_reason: string | null;
  published_at: string | null;
  platform_payloads?: Record<string, PlatformPayload>;
  workspace_id?: string;
  user_id?: string;
}

export type ListFilter = 'upcoming' | 'unscheduled' | 'published' | 'failed' | 'all';

export function mapApiItemToPost(item: Record<string, unknown>): ScheduledPost {
  const preview = item.previewMedia as Record<string, unknown> | null | undefined;
  return {
    id: String(item.id),
    content: String(item.content ?? ''),
    content_type: String(item.contentType ?? ''),
    platforms: item.platforms as string[] | undefined,
    title: item.title != null ? String(item.title) : null,
    status: String(item.status ?? 'draft'),
    created_at: String(item.created_at ?? ''),
    media_url: preview?.mediaUrl != null ? String(preview.mediaUrl) : null,
    media_type: preview?.mediaType != null ? String(preview.mediaType) : null,
    campaign_theme: item.campaignTheme != null ? String(item.campaignTheme) : null,
    scheduled_date: resolveScheduleDateStr(
      item.scheduledDate as string | Date | null | undefined,
    ),
    scheduled_time: item.scheduledTime != null ? String(item.scheduledTime) : null,
    publish_failed_reason:
      item.publishFailedReason != null ? String(item.publishFailedReason) : null,
    published_at: item.publishedAt != null ? String(item.publishedAt) : null,
    platform_payloads: item.platformPayloads as Record<string, PlatformPayload> | undefined,
    workspace_id: item.workspaceId != null ? String(item.workspaceId) : undefined,
    user_id: item.userId != null ? String(item.userId) : undefined,
  };
}

export function sortPostsBySchedule(posts: ScheduledPost[]): ScheduledPost[] {
  return [...posts].sort((a, b) => {
    const aKey = getScheduleSortKey(a.scheduled_date, a.scheduled_time);
    const bKey = getScheduleSortKey(b.scheduled_date, b.scheduled_time);
    if (aKey !== bKey) return aKey - bKey;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

export function filterPosts(
  posts: ScheduledPost[],
  filter: ListFilter,
  options: { showTeam: boolean; userId?: string },
): ScheduledPost[] {
  let list = posts;

  if (!options.showTeam && options.userId) {
    list = list.filter((p) => p.user_id === options.userId);
  }

  const now = Date.now();

  switch (filter) {
    case 'upcoming':
      return list.filter(
        (p) =>
          isScheduledStatus(p.status) &&
          p.scheduled_date &&
          getScheduleSortKey(p.scheduled_date, p.scheduled_time) >= now,
      );
    case 'unscheduled':
      return list.filter(
        (p) =>
          !p.scheduled_date &&
          p.status !== 'published' &&
          p.status !== 'rejected',
      );
    case 'published':
      return list.filter((p) => p.status === 'published');
    case 'failed':
      return list.filter((p) => Boolean(p.publish_failed_reason));
    default:
      return list;
  }
}

export function getScheduledPosts(posts: ScheduledPost[]): ScheduledPost[] {
  return posts.filter((p) => Boolean(p.scheduled_date));
}

export function getUnscheduledPosts(posts: ScheduledPost[]): ScheduledPost[] {
  return posts.filter(
    (p) =>
      !p.scheduled_date &&
      p.status !== 'published' &&
      p.status !== 'rejected',
  );
}

export function countDueToday(posts: ScheduledPost[]): number {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return posts.filter(
    (p) => p.scheduled_date === todayStr && isScheduledStatus(p.status),
  ).length;
}

export function countOverdue(posts: ScheduledPost[]): number {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return posts.filter((p) => {
    if (!p.scheduled_date || !isScheduledStatus(p.status)) return false;
    if (p.scheduled_date < todayStr) return true;
    if (p.scheduled_date === todayStr) {
      return isDueOrOverdue(p.scheduled_date, p.scheduled_time, p.status);
    }
    return false;
  }).length;
}
