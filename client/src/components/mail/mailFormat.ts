import { format, isThisWeek, isThisYear, isToday } from 'date-fns';

/** "jane.banda@acme.co" → "Jane Banda"; keeps the address when it has no usable name. */
export function senderName(email: string): string {
  const named = email.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  if (named) return named[1].trim();
  const local = email.split('@')[0] ?? email;
  const words = local.split(/[._-]+/).filter((w) => w && !/^\d+$/.test(w));
  if (!words.length) return email;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** The bare address from `Name <a@b.c>` or a plain address. */
export function senderAddress(email: string): string {
  return email.match(/<([^>]+)>/)?.[1] ?? email.trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

/** 14:05 today, Mon this week, 3 Nov this year, otherwise 3 Nov 2025. */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (isToday(d)) return format(d, 'HH:mm');
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, 'EEE');
  if (isThisYear(d)) return format(d, 'd MMM');
  return format(d, 'd MMM yyyy');
}

export function fullTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, "EEE d MMM yyyy 'at' HH:mm");
}

export type MailStatusTone = 'new' | 'ready' | 'muted' | 'error';

export function mailStatus(status: string): { label: string; tone: MailStatusTone } {
  switch (status) {
    case 'processed':
      return { label: 'Draft ready', tone: 'ready' };
    case 'skipped':
      return { label: 'Skipped · bulk mail', tone: 'muted' };
    case 'failed':
      return { label: 'Draft failed', tone: 'error' };
    default:
      return { label: 'New', tone: 'new' };
  }
}

export const toneDot: Record<MailStatusTone, string> = {
  new: 'bg-primary',
  ready: 'bg-emerald-500',
  muted: 'bg-muted-foreground/40',
  error: 'bg-destructive',
};

export const toneText: Record<MailStatusTone, string> = {
  new: 'text-primary',
  ready: 'text-emerald-700 dark:text-emerald-400',
  muted: 'text-muted-foreground',
  error: 'text-destructive',
};

/** A soft, stable colour per sender so the list is easy to scan. */
const AVATAR_TONES = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
];
export function avatarTone(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}
