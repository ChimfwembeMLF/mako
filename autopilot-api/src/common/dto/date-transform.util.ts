/** Coerce JSON date strings (and Date) for class-validator @IsDate() fields. */
export function toOptionalDate(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const raw = String(value).trim();
  if (!raw) return undefined;

  // Calendar date from scheduler UI: YYYY-MM-DD
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const d = new Date(
      `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00.000Z`,
    );
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Time-of-day strings from scheduler (HH:mm or HH:mm:ss). */
export function toOptionalTimeString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    const h = value.getUTCHours().toString().padStart(2, '0');
    const m = value.getUTCMinutes().toString().padStart(2, '0');
    const s = value.getUTCSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  const raw = String(value).trim();
  if (!raw) return undefined;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw;
  const h = match[1].padStart(2, '0');
  const m = match[2];
  const s = (match[3] ?? '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}
