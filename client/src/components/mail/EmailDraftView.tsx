import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmailDraftItem = {
  id: string;
  toEmail: string;
  subject: string | null;
  body: string;
  createdAt: string;
  gmailThreadUrl: string | null;
  gmailDraftsUrl: string;
};

export function EmailDraftView({
  draft,
  className,
}: {
  draft: EmailDraftItem;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col h-full bg-background rounded-lg border overflow-hidden', className)}>
      <div className="px-4 sm:px-5 py-4 border-b bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wide">
          <FileText className="h-3.5 w-3.5" />
          Draft reply — review in Gmail before sending
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">
            <span className="text-muted-foreground">To:</span>{' '}
            <span className="font-medium">{draft.toEmail}</span>
          </p>
          <Badge variant="secondary" className="text-[10px]">Draft</Badge>
        </div>
        <p className="text-base font-medium">{draft.subject || '(no subject)'}</p>
        <p className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {draft.gmailThreadUrl && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
              <a href={draft.gmailThreadUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                View thread
              </a>
            </Button>
          )}
          <Button variant="default" size="sm" className="gap-1.5 h-8" asChild>
            <a href={draft.gmailDraftsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Gmail
            </a>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 max-w-3xl">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{draft.body}</p>
        </div>
      </div>
    </div>
  );
}
