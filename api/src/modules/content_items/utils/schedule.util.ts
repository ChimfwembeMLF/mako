import { ContentItems } from '../entities/content_items.entity';

/** Calendar date from DB `date` column — never shift via toISOString(). */
export function resolveScheduleDateStr(
  scheduledDate: Date | string | null | undefined,
): string | null {
  if (scheduledDate == null) return null;

  if (scheduledDate instanceof Date) {
    if (Number.isNaN(scheduledDate.getTime())) return null;
    const y = scheduledDate.getUTCFullYear();
    const m = String(scheduledDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(scheduledDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const raw = String(scheduledDate).trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return dateOnly ? `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}` : null;
}

/** Wall-clock hours/minutes from `timetz` / `HH:mm` strings. */
export function parseScheduledTimeParts(
  scheduledTime: string | null | undefined,
): { hours: number; minutes: number } {
  if (!scheduledTime) return { hours: 0, minutes: 0 };
  const raw = String(scheduledTime).trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return { hours: 0, minutes: 0 };
  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
  };
}

/** Local Date when this item should publish (server local timezone). */
export function resolveScheduledDueAt(item: ContentItems): Date | null {
  const dateStr = resolveScheduleDateStr(item.scheduledDate);
  if (!dateStr) return null;

  const { hours, minutes } = parseScheduledTimeParts(item.scheduledTime);
  const dueAt = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dueAt.getTime())) return null;
  dueAt.setHours(hours, minutes, 0, 0);
  return dueAt;
}

/** True when a schedulable item's date/time is in the past. */
export function isContentDue(item: ContentItems, now = new Date()): boolean {
  const schedulable = item.status === 'approved' || item.status === 'scheduled';
  if (!schedulable) return false;

  const dueAt = resolveScheduledDueAt(item);
  if (!dueAt) return false;

  return dueAt.getTime() <= now.getTime();
}

/** Items approved for today (or earlier) that haven't been published yet. */
export function isContentDueOrOverdue(
  item: ContentItems,
  now = new Date(),
): boolean {
  return isContentDue(item, now) && item.status === 'approved';
}
