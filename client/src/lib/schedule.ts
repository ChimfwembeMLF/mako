/** Format content scheduled date + time for display. */
export function formatScheduledAt(
  scheduledDate?: string | Date | null,
  scheduledTime?: string | Date | null,
): string | null {
  if (!scheduledDate) return null;

  const dateStr =
    scheduledDate instanceof Date
      ? `${scheduledDate.getUTCFullYear()}-${String(scheduledDate.getUTCMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getUTCDate()).padStart(2, '0')}`
      : String(scheduledDate).slice(0, 10);

  let hours = 0;
  let minutes = 0;
  if (scheduledTime) {
    const match = String(scheduledTime).match(/(\d{1,2}):(\d{2})/);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
    }
  }

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

export function isScheduledStatus(status?: string | null): boolean {
  return status === 'scheduled' || status === 'approved';
}
