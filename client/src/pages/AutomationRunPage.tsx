import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Bot, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTenant } from '@/hooks/useTenant';
import { usePageBreadcrumb } from '@/hooks/usePageBreadcrumb';
import { useWorkspaceAutomationConfig, type AutomationRun } from '@/hooks/api/useWorkspaceAutomationConfig';
import { contentAiApi, contentItemsApi, queued } from '@/lib/api';
import { platformOf } from '@/lib/platforms';
import { formatScheduledAt } from '@/lib/schedule';
import { plainText } from '@/components/replies/postInboxUtils';
import { StatusPill } from '@/components/StatusPill';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Post = {
  id: string;
  title?: string | null;
  content?: string | null;
  status?: string | null;
  platforms?: string[] | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
};

/** How each run outcome reads, mapped onto the shared status colours. */
const RUN_STATUS: Record<AutomationRun['status'], { label: string; status: string; headline: string }> = {
  success: { label: 'Drafts ready', status: 'published', headline: 'Drafts written and waiting for approval' },
  partial: { label: 'Partly done', status: 'partial', headline: 'Some drafts were written' },
  failed: { label: 'Failed', status: 'failed', headline: 'This run didn’t write any posts' },
  skipped: { label: 'Skipped', status: 'skipped', headline: 'This run was skipped' },
};

function runTitle(at: string) {
  return format(new Date(at), "EEE d MMM 'at' HH:mm");
}

export default function AutomationRunPage() {
  const { runAt = '' } = useParams<{ runAt: string }>();
  const at = decodeURIComponent(runAt);
  const { activeWorkspace } = useWorkspace();
  const { tenant } = useTenant();
  const { config, isLoading, refetch } = useWorkspaceAutomationConfig(activeWorkspace);
  const [posts, setPosts] = useState<Array<Post | { id: string; missing: true }>>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  const runs = useMemo(() => config?.recentRuns ?? [], [config]);
  const run = runs.find((r) => r.at === at) ?? null;
  usePageBreadcrumb(run ? runTitle(run.at) : undefined);

  const loadPosts = useCallback(async (ids: string[]) => {
    setLoadingPosts(true);
    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          return (await contentItemsApi.findOne(id)) as Post;
        } catch {
          return { id, missing: true as const };
        }
      }),
    );
    setPosts(rows);
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    if (run?.contentIds?.length) void loadPosts(run.contentIds);
    else setPosts([]);
  }, [run, loadPosts]);

  async function runAgain() {
    if (!tenant?.id || !activeWorkspace) return;
    setRerunning(true);
    try {
      const result = await queued(contentAiApi.dailyWorkflow(tenant.id, activeWorkspace));
      if ((result?.generated ?? 0) > 0) toast.success(`${result.generated} new draft${result.generated === 1 ? '' : 's'} written.`);
      else toast.error(result?.errors?.[0]?.replace(/^[^:]+:\s*/, '') ?? 'Nothing was generated.');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not run the automation.');
    } finally {
      setRerunning(false);
    }
  }

  if (isLoading && !config) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading run…
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="font-medium">This run is no longer in the history</p>
        <p className="text-sm text-muted-foreground">Mako keeps the last 10 runs for each workspace.</p>
        <Button asChild variant="outline"><Link to="/scheduler?view=automations"><ArrowLeft className="mr-1.5 h-4 w-4" /> Automations</Link></Button>
      </div>
    );
  }

  const meta = RUN_STATUS[run.status];
  const needsPlan = /plan|upgrade|starter|pro\b/i.test(run.message);
  const found = posts.filter((p): p is Post => !('missing' in p));
  const waiting = found.filter((p) => ['draft', 'review', 'pending', 'pending_approval'].includes((p.status ?? '').toLowerCase())).length;

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/scheduler?view=automations" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Automations
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Run on {runTitle(run.at)}</h1>
            <StatusPill status={meta.status} label={meta.label} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {run.trigger === 'manual' ? 'Started by hand with Generate now' : 'Started automatically on schedule'} ·{' '}
            {formatDistanceToNow(new Date(run.at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {waiting > 0 && (
            <Button variant="outline" asChild><Link to="/scheduler?view=list">Review in Schedule</Link></Button>
          )}
          {needsPlan ? (
            <Button asChild><Link to="/billing">See plans</Link></Button>
          ) : (
            <Button onClick={() => void runAgain()} disabled={rerunning} className="gap-1.5">
              {rerunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {rerunning ? 'Writing…' : 'Run again now'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section
            className={cn(
              'rounded-2xl border p-5 sm:p-6',
              run.status === 'failed' && 'border-destructive/30 bg-destructive/5',
              run.status === 'skipped' && 'bg-muted/40',
              run.status === 'partial' && 'border-amber-300/70 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
              run.status === 'success' && 'bg-card',
            )}
          >
            <p className="font-display text-lg font-semibold">{meta.headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{run.message}</p>
            {(run.status === 'success' || run.status === 'partial') && (
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Posts written</dt><dd className="mt-0.5 font-display text-2xl font-semibold tabular-nums">{run.generated}</dd></div>
              <div>
                <dt className="text-xs text-muted-foreground">Planned for</dt>
                <dd className="mt-1">{run.targetDate ? format(new Date(`${run.targetDate}T12:00:00`), 'EEE d MMM') : '—'}</dd>
              </div>
              <div><dt className="text-xs text-muted-foreground">Waiting for approval</dt><dd className="mt-0.5 font-display text-2xl font-semibold tabular-nums">{waiting}</dd></div>
            </dl>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card">
            <h2 className="border-b px-5 py-3 text-sm font-semibold">Posts from this run</h2>
            {!run.contentIds?.length ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                {run.status === 'success' || run.status === 'partial' ? 'This run didn’t record which posts it wrote.' : 'No posts were written in this run.'}
              </p>
            ) : loadingPosts ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading posts…</div>
            ) : (
              <ul className="divide-y">
                {posts.map((p) =>
                  'missing' in p ? (
                    <li key={p.id} className="px-5 py-4 text-sm text-muted-foreground">A post from this run has since been deleted.</li>
                  ) : (
                    <li key={p.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {(p.platforms ?? []).map((pl) => {
                            const plat = platformOf(pl);
                            const Icon = plat.icon;
                            return <Icon key={pl} size={13} style={{ color: plat.color }} aria-label={plat.label} />;
                          })}
                          {formatScheduledAt(p.scheduledDate, p.scheduledTime) && <span>{formatScheduledAt(p.scheduledDate, p.scheduledTime)}</span>}
                        </div>
                        <Link to={`/content/${p.id}`} className="mt-1 block text-sm font-medium hover:underline hover:underline-offset-4">
                          {p.title || 'Untitled post'}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{plainText(p.content ?? '')}</p>
                      </div>
                      <StatusPill status={p.status} label={(p.status ?? 'draft') === 'draft' ? 'Needs approval' : undefined} className="shrink-0 self-start" />
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4" /> Automation</h2>
              <Link to="/scheduler?view=automations" className="text-xs font-medium text-primary hover:underline">Settings</Link>
            </div>
            {config && (
              <dl className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-y-2 text-xs">
                <dt className="text-muted-foreground">Status</dt><dd>{config.isActive ? 'On' : 'Off'}</dd>
                <dt className="text-muted-foreground">Writes at</dt><dd>{config.generateAt} · {config.timezone}</dd>
                <dt className="text-muted-foreground">Posts each run</dt><dd>{config.postsPerCycle}</dd>
                <dt className="text-muted-foreground">Posting days</dt><dd>{config.publishingDays?.length ? config.publishingDays.join(', ') : 'Every day'}</dd>
                <dt className="text-muted-foreground">Times</dt><dd>{(config.postingTimes ?? []).join(', ') || '—'}</dd>
                <dt className="text-muted-foreground">Channels</dt><dd>{(config.platforms ?? []).map((p) => platformOf(p).label).join(', ') || '—'}</dd>
              </dl>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card">
            <h2 className="border-b px-5 py-3 text-sm font-semibold">Recent runs</h2>
            <ul className="divide-y">
              {runs.map((r) => {
                const m = RUN_STATUS[r.status];
                return (
                  <li key={r.at}>
                    <Link
                      to={`/automations/runs/${encodeURIComponent(r.at)}`}
                      className={cn('flex items-center justify-between gap-2 px-5 py-2.5 text-xs transition-colors hover:bg-muted/50', r.at === run.at && 'bg-muted')}
                      aria-current={r.at === run.at ? 'page' : undefined}
                    >
                      <span>{format(new Date(r.at), 'd MMM, HH:mm')}{r.trigger === 'manual' ? ' · by hand' : ''}</span>
                      <StatusPill status={m.status} label={r.generated ? `${r.generated} written` : m.label} className="px-2 text-[11px]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="border-t px-5 py-2.5 text-[11px] text-muted-foreground">The last 10 runs are kept.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
