import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuggestedFieldProps {
  id?: string;
  type: 'input' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnhance?: () => void | Promise<void>;
  enhancing?: boolean;
  rows?: number;
  className?: string;
}

/**
 * A text field with its AI action built into the frame: a labelled button that writes
 * the field when it is empty and improves it when it has text. Long fields get a small
 * footer with a character count; short ones keep the button at the end of the line.
 */
export function SuggestedField({
  id,
  type,
  value,
  onChange,
  placeholder,
  onEnhance,
  enhancing = false,
  rows = 4,
  className,
}: SuggestedFieldProps) {
  const hasText = value.trim().length > 0;
  const actionLabel = hasText ? 'Improve' : type === 'textarea' ? 'Write it' : 'Suggest';
  const actionHint = hasText ? 'Rewrite this with AI, in your Brand voice' : 'Let AI write this, in your Brand voice';

  const action = onEnhance && (
    <button
      type="button"
      onClick={() => void onEnhance()}
      disabled={enhancing}
      title={actionHint}
      aria-label={`${actionLabel} with AI`}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
        'bg-primary/10 text-foreground hover:bg-primary/20 disabled:cursor-wait disabled:opacity-70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {enhancing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      )}
      <span className={cn(type === 'input' && 'hidden sm:inline')}>{enhancing ? 'Writing…' : actionLabel}</span>
    </button>
  );

  const frame = cn(
    'group/field relative w-full rounded-md border border-foreground bg-card transition-shadow',
    'focus-within:ring-2 focus-within:ring-foreground',
    enhancing && 'ring-2 ring-primary/40',
    className,
  );
  const control =
    'w-full border-0 bg-transparent px-4 text-body-md placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed';

  if (type === 'input') {
    return (
      <div className={cn(frame, 'flex h-12 items-center gap-2 pr-2')}>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-busy={enhancing || undefined}
          className={cn(control, 'h-full min-w-0 flex-1 py-3')}
        />
        {action}
      </div>
    );
  }

  return (
    <div className={frame}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-busy={enhancing || undefined}
        className={cn(control, 'block min-h-[80px] resize-y pb-2 pt-3')}
      />
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-2 py-1.5 pl-4">
        <span className="text-[11px] tabular-nums text-muted-foreground" aria-live="off">
          {hasText ? `${value.length.toLocaleString()} characters` : ''}
        </span>
        {action}
      </div>
    </div>
  );
}
