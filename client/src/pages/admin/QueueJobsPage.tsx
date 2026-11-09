import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Clock, ExternalLink, Info, Loader2, Pause, PlayCircle,
  RefreshCw, RotateCcw, Send, MessageSquareReply, Webhook, Sparkles, Mail, Layers,
} from 'lucide-react';
import { API_BASE_URL, queueJobsApi, type QueueJobStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { confirmModal } from '@/components/ConfirmModal';
import { toast } from '@/hooks/use-toast';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { cn } from '@/lib/utils';

type JobState = 'all' | 'failed' | 'active' | 'waiting' | 'delayed' | 'completed' | 'paused';

const STATE_TABS: { id: JobState; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'failed', label: 'Failed' },
  { id: 'active', label: 'Running' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'delayed', label: 'Delayed' },
  { id: 'completed', label: 'Done' },
  { id: 'paused', label: 'Paused' },
];

const STATE_META: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  active: { label: 'Running', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', icon: PlayCircle },
  waiting: { label: 'Waiting', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: Clock },
  'waiting-children': { label: 'Waiting', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: Clock },
  prioritized: { label: 'Waiting', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: Clock },
  delayed: { label: 'Delayed', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300', icon: Clock },
  completed: { label: 'Done', className: 'bg-green-600/10 text-green-700 dark:text-green-300', icon: CheckCircle2 },
  paused: { label: 'Paused', className: 'bg-muted text-muted-foreground', icon: Pause },
};

/** What each queue does, in words someone running the platform would use. */
const QUEUE_INFO: Record<string, { label: string; hint: string; icon: typeof Send }> = {
  'content-publish': { label: 'Publishing', hint: 'Sends posts to the social networks', icon: Send },
  comments: { label: 'Comments', hint: 'Syncs comments and sends replies', icon: MessageSquareReply },
  webhooks: { label: 'Webhooks', hint: 'Events coming in from Meta, X and others', icon: Webhook },
  ai: { label: 'AI', hint: 'Writing, images and suggestions', icon: Sparkles },
  email: { label: 'Email', hint: 'Invites, notifications and campaigns', icon: Mail },
};
const queueInfo = (q: string) =>
  QUEUE_INFO[q] ?? { label: q.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), hint: 'Background jobs', icon: Layers };

const AUTO_REFRESH_MS = 10_000;
const PAGE = 20;
const waitingCount = (s: Record<string, number>) =>
  (s.waiting ?? 0) + (s['waiting-children'] ?? 0) + (s.prioritized ?? 0) + (s.delayed ?? 0);

function timeAgo(ts?: number): string {
  if (!ts) return '—';
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function duration(job: QueueJobStatus): string | null {
  if (!job.timestamp || !job.finishedOn) return null;
  const ms = job.finishedOn - job.timestamp;
  return ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}

function StatePill({ state }: { state: string }) {
  const meta = STATE_META[state] ?? { label: state, className: 'bg-muted text-muted-foreground', icon: Clock };
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function JobRow({ job, onRetry, retrying }: { job: QueueJobStatus; onRetry: () => void; retrying: boolean }) {
  const [open, setOpen] = useState(false);
  const attempts = job.attemptsMade ?? 0;
  const max = job.maxAttempts ?? 5;
  const exhausted = attempts >= max;
  const firstLine = job.failedReason?.split('\n')[0];
  const took = duration(job);

  return (
    <li className={cn('transition-colors', open && 'bg-muted/30')}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{job.name}</span>
              <StatePill state={job.state} />
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {firstLine ? <span className="text-destructive">{firstLine}</span> : <span className="font-mono">#{job.id}</span>}
            </span>
          </span>
        </button>
        <span className="hidden w-20 shrink-0 text-xs tabular-nums text-muted-foreground sm:block" title="Attempts used">
          {attempts}/{max} tries
        </span>
        <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:block" title={job.timestamp ? new Date(job.timestamp).toLocaleString() : undefined}>
          {timeAgo(job.timestamp)}
        </span>
        <div className="flex w-20 shrink-0 justify-end">
          {job.state === 'failed' &&
            (exhausted ? (
              <span className="text-[11px] text-muted-foreground" title="It used every attempt. Fix the cause, then retry it from Bull Board.">
                Out of tries
              </span>
            ) : (
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" onClick={onRetry} disabled={retrying}>
                {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Retry
              </Button>
            ))}
        </div>
      </div>
      {open && (
        <div className="space-y-3 px-4 pb-4 pl-11">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Job ID</dt><dd className="font-mono">{job.id}</dd></div>
            <div><dt className="text-muted-foreground">Created</dt><dd>{job.timestamp ? new Date(job.timestamp).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-muted-foreground">Finished</dt><dd>{job.finishedOn ? new Date(job.finishedOn).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-muted-foreground">Took</dt><dd>{took ?? '—'}</dd></div>
          </dl>
          {job.failedReason && (
            <div>
              <p className="mb-1 text-xs font-medium text-destructive">Error</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-destructive/5 p-3 font-mono text-[11px] leading-relaxed text-destructive">
                {job.failedReason}
              </pre>
            </div>
          )}
          {job.data !== undefined && job.data !== null && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Job data</p>
              <pre className="max-h-60 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(job.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function QueueJobsContent() {
  const [queues, setQueues] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [statsByQueue, setStatsByQueue] = useState<Record<string, Record<string, number>>>({});
  const [selectedQueue, setSelectedQueue] = useState('content-publish');
  const [selectedState, setSelectedState] = useState<JobState>('all');
  const [jobs, setJobs] = useState<QueueJobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => setShown(PAGE), [selectedQueue, selectedState]);

  const loadOverview = useCallback(async () => {
    const data = await queueJobsApi.listQueues();
    setQueues(data.queues);
    setEnabled(data.enabled);
    setSelectedQueue((current) => (data.queues.length && !data.queues.includes(current) ? data.queues[0] : current));
    const entries = await Promise.all(
      data.queues.map(async (q) => [q, await queueJobsApi.getStats(q).catch(() => ({}))] as const),
    );
    setStatsByQueue(Object.fromEntries(entries));
  }, []);

  const loadJobs = useCallback(async () => {
    if (!selectedQueue) return;
    setRefreshing(true);
    setLoadError('');
    try {
      const [rows, stats] = await Promise.all([
        queueJobsApi.listJobs(selectedQueue, { state: selectedState, end: 99 }),
        queueJobsApi.getStats(selectedQueue),
      ]);
      setJobs(rows);
      setStatsByQueue((prev) => ({ ...prev, [selectedQueue]: stats }));
      setUpdatedAt(Date.now());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadError(message);
      setJobs([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedQueue, selectedState]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverview().catch(() => {}), loadJobs()]);
  }, [loadOverview, loadJobs]);

  useEffect(() => {
    void loadOverview().catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });
  }, [loadOverview]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshAll();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(t);
  }, [autoRefresh, refreshAll]);

  const counts = statsByQueue[selectedQueue] ?? {};
  const failedCount = counts.failed ?? 0;
  const info = queueInfo(selectedQueue);
  const totals = useMemo(() => {
    const all = Object.values(statsByQueue);
    return {
      failed: all.reduce((n, s) => n + (s.failed ?? 0), 0),
      active: all.reduce((n, s) => n + (s.active ?? 0), 0),
      waiting: all.reduce((n, s) => n + waitingCount(s), 0),
    };
  }, [statsByQueue]);

  const handleRetry = async (job: QueueJobStatus) => {
    setRetryingId(String(job.id));
    try {
      await queueJobsApi.retryJob(job.queue, job.id);
      toast({ title: 'Sent back to the queue', description: `${job.name} #${job.id}` });
      await refreshAll();
    } catch (err: unknown) {
      toast({ title: "Couldn't retry it", description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAllFailed = async () => {
    const ok = await confirmModal(
      `All ${failedCount} failed ${info.label.toLowerCase()} job${failedCount === 1 ? '' : 's'} will run again. If the cause isn't fixed they will likely fail again.`,
      `Retry ${failedCount} failed job${failedCount === 1 ? '' : 's'}?`,
      'Retry all',
    );
    if (!ok) return;
    setRetryingAll(true);
    try {
      const result = await queueJobsApi.retryAllFailed(selectedQueue);
      toast({ title: 'Failed jobs sent back to the queue', description: `${result.retried} job${result.retried === 1 ? '' : 's'} will run again.` });
      await refreshAll();
    } catch (err: unknown) {
      toast({ title: "Couldn't retry them", description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setRetryingAll(false);
    }
  };

  const bullBoardUrl = `${API_BASE_URL.replace(/\/$/, '')}/admin/queues`;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading queues…
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Job queues</h1>
          <p className="text-sm text-muted-foreground">
            Work Mako does in the background: publishing, comments, AI and email.{' '}
            {totals.failed > 0 ? (
              <span className="font-medium text-destructive">{totals.failed} failed across all queues.</span>
            ) : (
              <span>Nothing has failed.</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="Refresh every 10 seconds" />
            Live
          </label>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full" onClick={() => void refreshAll()} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 rounded-full" asChild>
            <a href={bullBoardUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Bull Board
            </a>
          </Button>
        </div>
      </div>

      {!enabled && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p>
            <span className="font-medium">Queues are off on this server, so jobs run straight away instead of waiting here.</span>{' '}
            <span className="text-muted-foreground">
              Anything listed below is left over from when they were on. Set <code className="rounded bg-muted px-1">QUEUES_ENABLED=true</code> to use them.
            </span>
          </p>
        </div>
      )}

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Couldn't load jobs: {loadError}</p>
        </div>
      )}

      {/* Queue overview */}
      {/* Phones: a sideways row so the jobs stay near the top. */}
      <div
        className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-5 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Queues"
      >
        {queues.map((q) => {
          const s = statsByQueue[q] ?? {};
          const qi = queueInfo(q);
          const Icon = qi.icon;
          const selected = q === selectedQueue;
          const failed = s.failed ?? 0;
          return (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setSelectedQueue(q);
                setSelectedState(failed > 0 ? 'failed' : 'all');
              }}
              className={cn(
                'w-[250px] shrink-0 snap-start rounded-2xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto',
                selected ? 'border-primary ring-1 ring-primary/30' : failed > 0 ? 'border-destructive/40 hover:border-destructive/70' : 'border-border/70 hover:border-foreground/30',
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', failed > 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{qi.label}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{q}</span>
                </span>
              </span>
              <span className="mt-3 block min-h-[2rem] text-xs leading-4 text-muted-foreground line-clamp-2">{qi.hint}</span>
              <span className="mt-3 grid grid-cols-4 gap-1 text-center">
                {[
                  { n: failed, label: 'Failed', tone: failed > 0 ? 'text-destructive' : '' },
                  { n: s.active ?? 0, label: 'Running', tone: (s.active ?? 0) > 0 ? 'text-blue-600' : '' },
                  { n: waitingCount(s), label: 'Waiting', tone: '' },
                  { n: s.completed ?? 0, label: 'Done', tone: '' },
                ].map(({ n, label, tone }) => (
                  <span key={label} className="min-w-0">
                    <span className={cn('block font-display text-base font-semibold tabular-nums', n === 0 && 'text-muted-foreground/60', tone)}>
                      {n.toLocaleString()}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Jobs in the selected queue */}
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card" aria-label={`${info.label} jobs`}>
        <header className="flex flex-col gap-3 border-b border-border/60 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold">{info.label} jobs</h2>
            <p className="text-xs text-muted-foreground">
              Newest first, up to 100.{updatedAt ? ` Updated ${timeAgo(updatedAt)}.` : ''}
            </p>
          </div>
          {failedCount > 0 && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full border-destructive/40 text-destructive hover:text-destructive" onClick={() => void handleRetryAllFailed()} disabled={retryingAll}>
              {retryingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Retry all {failedCount} failed
            </Button>
          )}
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border/60 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Job state">
          {STATE_TABS.map((t) => {
            const active = selectedState === t.id;
            const n = t.id === 'waiting' ? (counts.waiting ?? 0) + (counts['waiting-children'] ?? 0) + (counts.prioritized ?? 0) : counts[t.id] ?? 0;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedState(t.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-3 text-sm transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
                  active ? 'font-medium text-foreground after:bg-primary' : 'text-muted-foreground hover:text-foreground after:bg-transparent',
                )}
              >
                {t.label}
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums leading-5', t.id === 'failed' && n > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
                  {n.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {jobs.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-600/10 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-medium">
              {selectedState === 'failed' ? 'No failed jobs' : `No ${selectedState === 'all' ? '' : `${STATE_TABS.find((t) => t.id === selectedState)?.label.toLowerCase()} `}jobs`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedState !== 'all' && (counts.all ?? 0) > 0 ? (
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => setSelectedState('all')}>
                  Show all {(counts.all ?? 0).toLocaleString()} jobs in {info.label}
                </button>
              ) : (
                `${info.label} has nothing queued.`
              )}
            </p>
          </div>
        ) : (
          <ul className={cn('divide-y divide-border/60', refreshing && 'opacity-70')}>
            {jobs.slice(0, shown).map((job) => (
              <JobRow key={`${job.queue}-${job.id}`} job={job} onRetry={() => void handleRetry(job)} retrying={retryingId === String(job.id)} />
            ))}
          </ul>
        )}
        {jobs.length > shown && (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {shown} of {jobs.length}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, jobs.length - shown)} more
            </Button>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Bull Board shows the same jobs with more tools. Protect it with <code className="rounded bg-muted px-1">BULL_BOARD_PASSWORD</code> on the API.
      </p>
    </div>
  );
}

export default function QueueJobsPage() {
  return (
    <SuperAdminRoute>
      <QueueJobsContent />
    </SuperAdminRoute>
  );
}
