/** Format content scheduled date + time for display. */
export function formatScheduledAt(
  scheduledDate?: string | Date | null,
  scheduledTime?: string | Date | null,
): string | null {
  if (!scheduledDate) return null;

  const dateStr = resolveScheduleDateStr(scheduledDate);
  if (!dateStr) return null;

  const { hours, minutes } = parseScheduledTimeParts(scheduledTime);

  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Calendar date from API — never shift via local timezone parsing of ISO strings. */
export function resolveScheduleDateStr(
  scheduledDate?: string | Date | null,
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

export function parseScheduledTimeParts(
  scheduledTime?: string | Date | null,
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

export function parseTimeForInput(value: string | null | undefined): string | null {
  const { hours, minutes } = parseScheduledTimeParts(value);
  if (value == null || String(value).trim() === '') return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatTimeDisplay(value: string | null | undefined): string | null {
  const parsed = parseTimeForInput(value);
  if (!parsed) return null;
  const [h, m] = parsed.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatScheduleLabel(
  date: string | null,
  time?: string | null,
): string {
  if (!date) return 'Not scheduled';
  const datePart = new Date(`${date}T12:00:00`).toLocaleDateString();
  const timePart = formatTimeDisplay(time);
  return timePart ? `${datePart} at ${timePart}` : datePart;
}

export function toLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toApiTime(value: string): string {
  const parsed = parseTimeForInput(value);
  return parsed ? `${parsed}:00` : '09:00:00';
}

export function getScheduleSortKey(
  scheduledDate: string | null,
  scheduledTime: string | null | undefined,
): number {
  if (!scheduledDate) return Number.MAX_SAFE_INTEGER;
  const { hours, minutes } = parseScheduledTimeParts(scheduledTime);
  const d = new Date(`${scheduledDate}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

export function isDueOrOverdue(
  scheduledDate: string | null,
  scheduledTime: string | null | undefined,
  status: string,
): boolean {
  if (!isScheduledStatus(status) || !scheduledDate) return false;
  const dueAt = getScheduleSortKey(scheduledDate, scheduledTime);
  return dueAt <= Date.now();
}

export function isScheduledStatus(status?: string | null): boolean {
  return status === 'scheduled' || status === 'approved';
}
