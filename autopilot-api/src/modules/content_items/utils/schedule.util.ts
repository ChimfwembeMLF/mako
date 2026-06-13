import { ContentItems } from '../entities/content_items.entity';

/** True when a schedulable item's date/time is in the past. */
export function isContentDue(item: ContentItems, now = new Date()): boolean {
  const schedulable = item.status === 'approved' || item.status === 'scheduled';
  if (!schedulable) return false;
  if (!item.scheduledDate) return false;

  const dateStr =
    item.scheduledDate instanceof Date
      ? item.scheduledDate.toISOString().slice(0, 10)
      : String(item.scheduledDate).slice(0, 10);

  let hours = 0;
  let minutes = 0;
  if (item.scheduledTime) {
    const raw = String(item.scheduledTime);
    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
    }
  }

  const dueAt = new Date(`${dateStr}T00:00:00`);
  dueAt.setHours(hours, minutes, 0, 0);
  return dueAt.getTime() <= now.getTime();
}

/** Items approved for today (or earlier) that haven't been published yet. */
export function isContentDueOrOverdue(item: ContentItems, now = new Date()): boolean {
  return isContentDue(item, now) && item.status === 'approved';
}
