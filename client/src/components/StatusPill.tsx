import { cn } from '@/lib/utils';
import { statusOf, TONE_DOT, TONE_PILL } from '@/lib/postStatus';

export function StatusPill({ status, label, className }: { status?: string | null; label?: string; className?: string }) {
  const s = statusOf(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', TONE_PILL[s.tone], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[s.tone])} aria-hidden />
      {label ?? s.label}
    </span>
  );
}
