import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, PenLine, RefreshCw } from 'lucide-react';
import { mailApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useIsMobile } from '@/hooks/use-mobile';
import { InboxSplitLayout } from '@/components/layout/InboxSplitLayout';
import { EmailDraftView } from '@/components/mail/EmailDraftView';
import { avatarTone, excerpt, initials, senderName, shortTime } from '@/components/mail/mailFormat';
import { cn } from '@/lib/utils';

type MailDraft = {
  id: string;
  toEmail: string;
  subject: string | null;
  body: string;
  createdAt: string;
  gmailThreadUrl: string | null;
  gmailDraftsUrl: string;
};

type Props = {
  refreshKey?: number;
  onCount?: (count: number) => void;
  onOpenRules?: () => void;
};

export function EmailDraftsList({ refreshKey = 0, onCount, onOpenRules }: Props) {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const isMobile = useIsMobile();
  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    if (!tenant?.id) {
      setDrafts([]);
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      const { items } = await mailApi.listDrafts({
        tenantId: tenant.id,
        workspaceId: activeWorkspace ?? undefined,
        limit: 50,
      });
      setDrafts(items);
      onCount?.(items.length);
      setSelectedId((prev) => {
        if (prev && items.some((item) => item.id === prev)) return prev;
        // Phones open on the list; the hook's first value can lag, so read the width directly.
        if (isMobile || window.matchMedia('(max-width: 767px)').matches) return null;
        return items[0]?.id ?? null;
      });
    } catch (err: unknown) {
      setDrafts([]);
      toast({
        title: 'Could not load draft replies',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id, activeWorkspace, toast, isMobile, onCount]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts, refreshKey]);

  const selected = useMemo(() => drafts.find((d) => d.id === selectedId) ?? null, [drafts, selectedId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading draft replies…
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <PenLine className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-display text-base font-semibold">No draft replies yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          When a new email matches one of your reply rules, Mako writes a reply and saves it as a Gmail draft for you to check and send.
        </p>
        {onOpenRules && (
          <button type="button" onClick={onOpenRules} className="mt-4 text-sm font-medium text-primary underline-offset-2 hover:underline">
            Set up reply rules
          </button>
        )}
      </div>
    );
  }

  const listPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          {drafts.length} waiting for review
        </p>
        <button
          type="button"
          onClick={() => void loadDrafts()}
          disabled={refreshing}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Refresh drafts"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {drafts.map((draft) => {
          const name = senderName(draft.toEmail);
          const active = selectedId === draft.id;
          return (
            <li key={draft.id}>
              <button
                type="button"
                onClick={() => setSelectedId(draft.id)}
                className={cn(
                  'relative flex w-full gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors',
                  active ? 'bg-primary/[0.06]' : 'hover:bg-muted/50',
                )}
                aria-current={active ? 'true' : undefined}
              >
                {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
                <span
                  className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', avatarTone(draft.toEmail))}
                  aria-hidden
                >
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      <span className="text-muted-foreground">To </span>
                      {name}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{shortTime(draft.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-foreground/80">{draft.subject || '(no subject)'}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{excerpt(draft.body, 90)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const detailPane = selected ? (
    <EmailDraftView draft={selected} className="h-full" />
  ) : (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
      <FileText className="mb-3 h-8 w-8 opacity-30" />
      Choose a draft to read it.
    </div>
  );

  return (
    <InboxSplitLayout
      list={listPane}
      detail={detailPane}
      hasSelection={Boolean(selected)}
      onBack={() => setSelectedId(null)}
      backLabel="Drafts"
      className="md:grid-cols-[minmax(260px,340px)_1fr]"
      listMinHeight="min-h-[420px] md:h-[calc(100dvh-20rem)] md:min-h-[520px]"
      detailMinHeight="min-h-[420px] md:h-auto md:min-h-0"
    />
  );
}
