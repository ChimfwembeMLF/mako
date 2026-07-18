import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Inbox, Loader2, Mail, RefreshCw } from 'lucide-react';
import { mailApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InboxSplitLayout } from '@/components/layout/InboxSplitLayout';
import { EmailThreadView } from '@/components/mail/EmailThreadView';
import { cn } from '@/lib/utils';

type InboundEmail = {
  id: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
  gmailThreadUrl: string | null;
  hasDraft: boolean;
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

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
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

function excerpt(text: string, max = 100): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function EmailInboxList({ refreshKey = 0 }: { refreshKey?: number }) {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const isMobile = useIsMobile();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    if (!tenant?.id) {
      setEmails([]);
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const { items } = await mailApi.listInbox({
        tenantId: tenant.id,
        workspaceId: activeWorkspace ?? undefined,
        limit: 50,
      });
      setEmails(items);
      setSelectedId((prev) => {
        if (prev && items.some((item) => item.id === prev)) return prev;
        if (isMobile) return null;
        return items[0]?.id ?? null;
      });
    } catch (err: unknown) {
      setEmails([]);
      toast({
        title: 'Could not load inbox',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id, activeWorkspace, toast, isMobile]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox, refreshKey]);

  const selected = useMemo(
    () => emails.find((email) => email.id === selectedId) ?? null,
    [emails, selectedId],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading inbox…
      </div>
    );
  }

  const listPane = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-3 border-b bg-muted/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="font-medium text-sm">Inbox</p>
            <p className="text-[11px] text-muted-foreground">Gmail messages</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 h-8"
          onClick={() => void loadInbox()}
          disabled={refreshing || !tenant?.id}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {emails.length === 0 ? (
        <div className="rounded-lg border border-dashed m-3 p-6 text-center text-sm text-muted-foreground">
          <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No emails synced yet. Connect Gmail and check your inbox.
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 min-h-0">
          {emails.map((email) => {
            const unreadStyle = email.status === 'received';
            return (
              <button
                key={email.id}
                type="button"
                onClick={() => setSelectedId(email.id)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b transition-colors',
                  selectedId === email.id
                    ? 'bg-primary/5 border-l-2 border-l-primary'
                    : 'hover:bg-muted/40',
                  unreadStyle && 'bg-background',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('text-sm truncate', unreadStyle ? 'font-semibold' : 'font-medium')}>
                    {email.fromEmail}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(email.createdAt), { addSuffix: false })}
                  </span>
                </div>
                <p className={cn('text-xs truncate mt-0.5', unreadStyle ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {email.subject || '(no subject)'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{excerpt(email.body, 80)}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge variant={statusVariant(email.status)} className="text-[9px] h-4">
                    {statusLabel(email.status)}
                  </Badge>
                  {email.hasDraft && (
                    <Badge variant="outline" className="text-[9px] h-4">Draft</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const detailPane = selected ? (
    <EmailThreadView message={selected} className="h-full" />
  ) : (
    <div className="h-full rounded-lg border border-dashed flex flex-col items-center justify-center text-sm text-muted-foreground p-6 text-center min-h-[280px]">
      <Mail className="h-10 w-10 mb-3 opacity-30" />
      Select an email to read the full message.
    </div>
  );

  return (
    <InboxSplitLayout
      list={listPane}
      detail={detailPane}
      hasSelection={Boolean(selected)}
      onBack={() => setSelectedId(null)}
      backLabel="Inbox"
      listMinHeight="min-h-[420px] md:min-h-[560px]"
      detailMinHeight="min-h-[420px] md:min-h-[560px]"
    />
  );
}
