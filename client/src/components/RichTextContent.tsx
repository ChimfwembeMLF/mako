import { sanitizeHtml } from '@/lib/sanitize';
import { normalizeRichContent } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface RichTextContentProps {
  html?: string;
  className?: string;
  emptyPlaceholder?: string;
}

/** Renders sanitized rich text (bold, links, lists) for previews and detail views. */
export function RichTextContent({
  html,
  className,
  emptyPlaceholder,
}: RichTextContentProps) {
  const normalized = normalizeRichContent(html ?? '');
  const safe = normalized ? sanitizeHtml(normalized) : '';

  if (!safe) {
    if (!emptyPlaceholder) return null;
    return <p className={cn('text-sm text-muted-foreground', className)}>{emptyPlaceholder}</p>;
  }

  return (
    <div
      className={cn(
        'text-sm leading-relaxed',
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-p:my-1.5 prose-p:text-foreground',
        'prose-headings:text-foreground prose-headings:font-display',
        'prose-strong:text-foreground prose-em:text-foreground',
        'prose-a:text-primary prose-a:underline prose-a:underline-offset-2',
        'prose-ul:my-2 prose-ol:my-2',
        'prose-blockquote:border-primary/30',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
