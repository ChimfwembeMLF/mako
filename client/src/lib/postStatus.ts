/** Plain-language labels and colours for post, publication and campaign statuses. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const POST: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  review: { label: 'Needs review', tone: 'warning' },
  pending: { label: 'Awaiting approval', tone: 'warning' },
  pending_approval: { label: 'Awaiting approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  publishing: { label: 'Publishing', tone: 'info' },
  published: { label: 'Published', tone: 'success' },
  partial: { label: 'Partly published', tone: 'warning' },
  publish_failed: { label: 'Didn’t publish', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
  active: { label: 'Scheduled', tone: 'info' },
};

export function statusOf(status?: string | null): { label: string; tone: StatusTone } {
  const key = (status ?? 'draft').toLowerCase();
  return POST[key] ?? { label: key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), tone: 'neutral' };
}

export const TONE_DOT: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground/50',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-destructive',
};

export const TONE_TEXT: Record<StatusTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-sky-700 dark:text-sky-400',
  success: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
};

export const TONE_PILL: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  danger: 'bg-destructive/10 text-destructive',
};
