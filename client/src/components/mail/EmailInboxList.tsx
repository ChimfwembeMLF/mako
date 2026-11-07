import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, Loader2, Mail, RefreshCw, Search } from 'lucide-react';
import { mailApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { InboxSplitLayout } from '@/components/layout/InboxSplitLayout';
import { EmailThreadView } from '@/components/mail/EmailThreadView';
import { avatarTone, excerpt, initials, mailStatus, senderName, shortTime, toneDot } from '@/components/mail/mailFormat';
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

type Filter = 'all' | 'new' | 'drafted';

type Props = {
  refreshKey?: number;
  onCount?: (count: number) => void;
  /** Whether Gmail can be used; shapes the empty state. */
  connected?: boolean;
  onConnect?: () => void;
};

export function EmailInboxList({ refreshKey = 0, onCount, connected = true, onConnect }: Props) {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const isMobile = useIsMobile();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

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
      onCount?.(items.filter((i) => i.status === 'received').length);
      setSelectedId((prev) => {
        if (prev && items.some((item) => item.id === prev)) return prev;
        // Phones open on the list; the hook's first value can lag, so read the width directly.
        if (isMobile || window.matchMedia('(max-width: 767px)').matches) return null;
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
  }, [tenant?.id, activeWorkspace, toast, isMobile, onCount]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox, refreshKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return emails.filter((e) => {
      if (filter === 'new' && e.status !== 'received') return false;
      if (filter === 'drafted' && !e.hasDraft) return false;
      if (!q) return true;
      return [e.fromEmail, e.subject ?? '', e.body].some((v) => v.toLowerCase().includes(q));
    });
  }, [emails, filter, query]);

  const selected = useMemo(() => emails.find((e) => e.id === selectedId) ?? null, [emails, selectedId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading inbox…
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-display text-base font-semibold">
          {connected ? 'Your inbox is clear' : 'Nothing here yet'}
        </h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {connected
            ? 'New Gmail messages appear here every few minutes. Check now to pull them in straight away.'
            : 'Connect Gmail and the messages customers send you will show up here, with draft replies ready to review.'}
        </p>
        {connected ? (
          <Button variant="outline" size="sm" className="mt-5 gap-1.5" onClick={() => void loadInbox()} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        ) : (
          onConnect && (
            <Button size="sm" className="mt-5" onClick={onConnect}>
              Connect Gmail
            </Button>
          )
        )}
      </div>
    );
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'drafted', label: 'Has draft' },
  ];

  const listPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2.5 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail"
            className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search mail"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  filter === f.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadInbox()}
            disabled={refreshing}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Refresh inbox"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="p-6 text-center text-xs text-muted-foreground">No messages match.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.map((email) => {
            const name = senderName(email.fromEmail);
            const isNew = email.status === 'received';
            const status = mailStatus(email.status);
            const active = selectedId === email.id;
            return (
              <li key={email.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(email.id)}
                  className={cn(
                    'relative flex w-full gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors',
                    active ? 'bg-primary/[0.06]' : 'hover:bg-muted/50',
                  )}
                  aria-current={active ? 'true' : undefined}
                >
                  {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                      avatarTone(email.fromEmail),
                    )}
                    aria-hidden
                  >
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', isNew ? 'font-semibold text-foreground' : 'font-medium text-foreground/90')}>
                        {name}
                      </span>
                      <span className={cn('shrink-0 text-[11px] tabular-nums', isNew ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                        {shortTime(email.createdAt)}
                      </span>
                    </span>
                    <span className={cn('mt-0.5 block truncate text-xs', isNew ? 'font-medium text-foreground' : 'text-foreground/80')}>
                      {email.subject || '(no subject)'}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{excerpt(email.body, 90)}</span>
                    <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn('h-1.5 w-1.5 rounded-full', toneDot[status.tone])} aria-hidden />
                      {status.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const detailPane = selected ? (
    <EmailThreadView message={selected} className="h-full" />
  ) : (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
      <Mail className="mb-3 h-8 w-8 opacity-30" />
      Choose a message to read it.
    </div>
  );

  return (
    <InboxSplitLayout
      list={listPane}
      detail={detailPane}
      hasSelection={Boolean(selected)}
      onBack={() => setSelectedId(null)}
      backLabel="Inbox"
      className="md:grid-cols-[minmax(260px,340px)_1fr]"
      listMinHeight="min-h-[420px] md:h-[calc(100dvh-20rem)] md:min-h-[520px]"
      detailMinHeight="min-h-[420px] md:h-auto md:min-h-0"
    />
  );
}
