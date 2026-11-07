import { ExternalLink, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { avatarTone, fullTime, initials, mailStatus, senderAddress, senderName, toneDot, toneText } from '@/components/mail/mailFormat';
import { cn } from '@/lib/utils';

export type EmailThreadMessage = {
  id: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
  gmailThreadUrl: string | null;
  hasDraft?: boolean;
};

export function EmailThreadView({ message, className }: { message: EmailThreadMessage; className?: string }) {
  const name = senderName(message.fromEmail);
  const address = senderAddress(message.fromEmail);
  const status = mailStatus(message.status);

  return (
    <article className={cn('flex h-full flex-col overflow-hidden rounded-xl border bg-card', className)}>
      <header className="border-b px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h2 className="font-display text-lg font-semibold leading-snug sm:text-xl">{message.subject || '(no subject)'}</h2>
          {message.gmailThreadUrl && (
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 self-start text-xs" asChild>
              <a href={message.gmailThreadUrl} target="_blank" rel="noopener noreferrer">
                Open in Gmail <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', avatarTone(message.fromEmail))}
            aria-hidden
          >
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {name}
              {name !== address && <span className="font-normal text-muted-foreground"> &lt;{address}&gt;</span>}
            </p>
            <p className="text-xs text-muted-foreground">{fullTime(message.createdAt)}</p>
          </div>
          <span className={cn('hidden shrink-0 items-center gap-1.5 text-xs font-medium sm:flex', toneText[status.tone])}>
            <span className={cn('h-1.5 w-1.5 rounded-full', toneDot[status.tone])} aria-hidden />
            {status.label}
          </span>
        </div>
      </header>

      {message.hasDraft && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-emerald-50/70 px-5 py-2.5 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200 sm:px-7">
          <span className="flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5" />
            A draft reply is waiting in Gmail. Nothing is sent until you send it.
          </span>
          {message.gmailThreadUrl && (
            <a href={message.gmailThreadUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              Review reply
            </a>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        <p className="max-w-[68ch] whitespace-pre-wrap text-sm leading-7 text-foreground/90">{message.body}</p>
      </div>
    </article>
  );
}
