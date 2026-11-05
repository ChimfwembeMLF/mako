import type { ComponentType } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  Hourglass,
  XCircle,
} from 'lucide-react';
import { getScheduleSortKey, isScheduledStatus } from '@/lib/schedule';

/**
 * What a post's state means to the person planning it. The stored status
 * alone isn't enough: an approved post in the past is overdue, a draft with a
 * date is waiting for approval, and a failed publish is kept in two places.
 */
export type PostDisplayStatus =
  | 'published'
  | 'failed'
  | 'overdue'
  | 'scheduled'
  | 'approved'
  | 'needs_approval'
  | 'draft'
  | 'rejected';

type StatusInput = {
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_failed_reason?: string | null;
};

const FAILED_STATUSES = new Set(['publish_failed', 'failed']);

export function getPostDisplayStatus(post: StatusInput, now: number = Date.now()): PostDisplayStatus {
  if (post.status === 'rejected') return 'rejected';
  if (post.status === 'published') return 'published';
  if (FAILED_STATUSES.has(post.status) || post.publish_failed_reason) return 'failed';
  if (isScheduledStatus(post.status)) {
    if (!post.scheduled_date) return 'approved';
    return getScheduleSortKey(post.scheduled_date, post.scheduled_time) < now ? 'overdue' : 'scheduled';
  }
  return post.scheduled_date ? 'needs_approval' : 'draft';
}

export type PostStatusMeta = {
  label: string;
  /** One-line explanation, shown in the preview and legend tooltips. */
  hint: string;
  icon: ComponentType<{ className?: string }>;
  /** Solid colour for dots and the left edge of calendar items. */
  dot: string;
  edge: string;
  /** Soft pill for badges. */
  badge: string;
};

export const POST_STATUS_META: Record<PostDisplayStatus, PostStatusMeta> = {
  scheduled: {
    label: 'Scheduled',
    hint: 'Approved and will publish automatically at the set time.',
    icon: CalendarCheck,
    dot: 'bg-blue-500',
    edge: 'border-l-blue-500',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  needs_approval: {
    label: 'Needs approval',
    hint: 'Has a date but will not publish until someone approves it.',
    icon: Hourglass,
    dot: 'bg-amber-500',
    edge: 'border-l-amber-500',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  overdue: {
    label: 'Overdue',
    hint: 'Its publish time has passed without it going out.',
    icon: Clock,
    dot: 'bg-orange-600',
    edge: 'border-l-orange-600',
    badge: 'bg-orange-600/10 text-orange-700 dark:text-orange-300',
  },
  failed: {
    label: 'Failed',
    hint: 'Publishing was attempted and did not succeed. Retry or edit it.',
    icon: AlertTriangle,
    dot: 'bg-destructive',
    edge: 'border-l-destructive',
    badge: 'bg-destructive/10 text-destructive',
  },
  published: {
    label: 'Published',
    hint: 'Live on its platforms.',
    icon: CheckCircle2,
    dot: 'bg-green-600',
    edge: 'border-l-green-600',
    badge: 'bg-green-600/10 text-green-700 dark:text-green-300',
  },
  approved: {
    label: 'Approved',
    hint: 'Approved but has no publish date yet.',
    icon: CalendarCheck,
    dot: 'bg-sky-400',
    edge: 'border-l-sky-400',
    badge: 'bg-sky-400/10 text-sky-700 dark:text-sky-300',
  },
  draft: {
    label: 'Draft',
    hint: 'Not scheduled and not approved.',
    icon: FileText,
    dot: 'bg-muted-foreground',
    edge: 'border-l-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
  },
  rejected: {
    label: 'Rejected',
    hint: 'Turned down in review and will not publish.',
    icon: XCircle,
    dot: 'bg-zinc-400',
    edge: 'border-l-zinc-400',
    badge: 'bg-zinc-400/15 text-zinc-600 dark:text-zinc-300 line-through decoration-1',
  },
};

/** Order used by the calendar legend. */
export const POST_STATUS_LEGEND: PostDisplayStatus[] = [
  'scheduled',
  'needs_approval',
  'overdue',
  'failed',
  'published',
  'rejected',
];

/** Which actions make sense for a post in a given state. */
export function getPostActions(status: PostDisplayStatus) {
  return {
    approve: status === 'needs_approval' || status === 'draft',
    publishNow: status === 'scheduled' || status === 'overdue' || status === 'approved' || status === 'needs_approval',
    retry: status === 'failed',
    reschedule: status !== 'published' && status !== 'rejected',
    reject: status !== 'published' && status !== 'rejected',
  };
}
