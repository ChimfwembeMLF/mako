import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { mailApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InboxSplitLayout } from '@/components/layout/InboxSplitLayout';
import { EmailDraftView } from '@/components/mail/EmailDraftView';
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

function excerpt(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function EmailDraftsList({ refreshKey = 0 }: { refreshKey?: number }) {
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
      setSelectedId((prev) => {
        if (prev && items.some((item) => item.id === prev)) return prev;
        if (isMobile) return null;
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
  }, [tenant?.id, activeWorkspace, toast, isMobile]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts, refreshKey]);

  const selected = useMemo(
    () => drafts.find((d) => d.id === selectedId) ?? null,
    [drafts, selectedId],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading draft replies…
      </div>
    );
  }

  const listPane = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-3 border-b bg-muted/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-sm">Draft replies</p>
            <p className="text-[11px] text-muted-foreground">Review in Gmail</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 h-8"
          onClick={() => void loadDrafts()}
          disabled={refreshing || !tenant?.id}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-dashed m-3 p-6 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No draft replies yet. Enable an email rule and check your inbox.
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 min-h-0">
          {drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => setSelectedId(draft.id)}
              className={cn(
                'w-full text-left px-3 py-3 border-b hover:bg-muted/40 transition-colors',
                selectedId === draft.id && 'bg-primary/5 border-l-2 border-l-primary',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate">To: {draft.toEmail}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: false })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {draft.subject || '(no subject)'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{excerpt(draft.body)}</p>
              <Badge variant="secondary" className="text-[9px] h-4 mt-1.5">Draft</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const detailPane = selected ? (
    <EmailDraftView draft={selected} className="h-full" />
  ) : (
    <div className="h-full rounded-lg border border-dashed flex flex-col items-center justify-center text-sm text-muted-foreground p-6 text-center min-h-[280px]">
      <FileText className="h-10 w-10 mb-3 opacity-30" />
      Select a draft to preview the reply before sending from Gmail.
    </div>
  );

  return (
    <InboxSplitLayout
      list={listPane}
      detail={detailPane}
      hasSelection={Boolean(selected)}
      onBack={() => setSelectedId(null)}
      backLabel="Drafts"
      listMinHeight="min-h-[420px] md:min-h-[560px]"
      detailMinHeight="min-h-[420px] md:min-h-[560px]"
    />
  );
}
