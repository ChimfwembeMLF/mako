import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { avatarTone, fullTime, initials, senderAddress, senderName } from '@/components/mail/mailFormat';
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

export function EmailDraftView({ draft, className }: { draft: EmailDraftItem; className?: string }) {
  const name = senderName(draft.toEmail);
  const address = senderAddress(draft.toEmail);

  return (
    <article className={cn('flex h-full flex-col overflow-hidden rounded-xl border bg-card', className)}>
      <header className="border-b px-5 py-5 sm:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">Draft reply · not sent</p>
        <h2 className="mt-1.5 font-display text-lg font-semibold leading-snug sm:text-xl">{draft.subject || '(no subject)'}</h2>
        <div className="mt-4 flex items-center gap-3">
          <span
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', avatarTone(draft.toEmail))}
            aria-hidden
          >
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              <span className="font-normal text-muted-foreground">To </span>
              {name}
              {name !== address && <span className="font-normal text-muted-foreground"> &lt;{address}&gt;</span>}
            </p>
            <p className="text-xs text-muted-foreground">Written {fullTime(draft.createdAt)}</p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        <div className="max-w-[68ch] rounded-lg border border-dashed border-amber-300/70 bg-amber-50/40 p-5 dark:border-amber-500/30 dark:bg-amber-500/5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">{draft.body}</p>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-xs text-muted-foreground">Edit and send it from Gmail. Mako never sends a draft on its own.</p>
        <div className="flex gap-2">
          {draft.gmailThreadUrl && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
              <a href={draft.gmailThreadUrl} target="_blank" rel="noopener noreferrer">
                View original
              </a>
            </Button>
          )}
          <Button size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <a href={draft.gmailDraftsUrl} target="_blank" rel="noopener noreferrer">
              Review in Gmail <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </footer>
    </article>
  );
}
