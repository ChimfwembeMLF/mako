import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Mail, Reply } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function statusLabel(status: string): string {
  switch (status) {
    case 'processed':
      return 'Draft ready';
    case 'skipped':
      return 'Skipped';
    case 'failed':
      return 'Failed';
    default:
      return 'Received';
  }
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'processed':
      return 'default';
    case 'failed':
      return 'destructive';
    case 'skipped':
      return 'outline';
    default:
      return 'secondary';
  }
}

export function EmailThreadView({
  message,
  className,
}: {
  message: EmailThreadMessage;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col h-full bg-background rounded-lg border overflow-hidden', className)}>
      <div className="px-4 sm:px-5 py-4 border-b bg-muted/20 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold break-all">{message.fromEmail}</p>
              <Badge variant={statusVariant(message.status)} className="text-[10px]">
                {statusLabel(message.status)}
              </Badge>
              {message.hasDraft && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Reply className="h-3 w-3" /> Draft reply
                </Badge>
              )}
            </div>
            <h2 className="text-base font-medium mt-1 leading-snug">
              {message.subject || '(no subject)'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </p>
          </div>
          {message.gmailThreadUrl && (
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
              <a href={message.gmailThreadUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Gmail
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <article className="max-w-3xl">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
            {message.body}
          </p>
        </article>
      </div>
    </div>
  );
}
