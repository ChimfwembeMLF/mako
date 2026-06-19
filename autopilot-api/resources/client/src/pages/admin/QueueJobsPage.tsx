import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { API_BASE_URL, queueJobsApi, type QueueJobStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';

const JOB_STATES = ['all', 'failed', 'active', 'waiting', 'delayed', 'completed', 'paused'] as const;

function formatTime(ts?: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function stateLabel(state: (typeof JOB_STATES)[number], counts: Record<string, number>) {
  const count =
    state === 'all'
      ? counts.all ?? 0
      : counts[state] ?? 0;
  return `${state} (${count})`;
}

function QueueJobsContent() {
  const [queues, setQueues] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState('content-publish');
  const [selectedState, setSelectedState] = useState<(typeof JOB_STATES)[number]>('all');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [jobs, setJobs] = useState<QueueJobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const loadQueues = useCallback(async () => {
    const data = await queueJobsApi.listQueues();
    setQueues(data.queues);
    setEnabled(data.enabled);
    if (data.queues.length && !data.queues.includes(selectedQueue)) {
      setSelectedQueue(data.queues[0]);
    }
  }, [selectedQueue]);

  const loadJobs = useCallback(async () => {
    setRefreshing(true);
    setLoadError('');
    try {
      const [rows, stats] = await Promise.all([
        queueJobsApi.listJobs(selectedQueue, { state: selectedState, end: 99 }),
        queueJobsApi.getStats(selectedQueue),
      ]);
      setJobs(rows);
      setCounts(stats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadError(message);
      setJobs([]);
      toast({
        title: 'Failed to load jobs',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedQueue, selectedState]);

  useEffect(() => {
    void loadQueues().catch(() => setLoading(false));
  }, [loadQueues]);

  useEffect(() => {
    if (!selectedQueue) return;
    void loadJobs();
  }, [selectedQueue, selectedState, loadJobs]);

  const handleRetry = async (job: QueueJobStatus) => {
    setRetryingId(String(job.id));
    try {
      await queueJobsApi.retryJob(job.queue, job.id);
      toast({ title: 'Job requeued', description: `${job.name} (${job.id})` });
      await loadJobs();
    } catch (err: unknown) {
      toast({
        title: 'Retry failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAllFailed = async () => {
    setRetryingAll(true);
    try {
      const result = await queueJobsApi.retryAllFailed(selectedQueue);
      toast({
        title: 'Failed jobs requeued',
        description: `${result.retried} job(s) sent back to the queue`,
      });
      await loadJobs();
    } catch (err: unknown) {
      toast({
        title: 'Bulk retry failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setRetryingAll(false);
    }
  };

  const bullBoardUrl = `${API_BASE_URL.replace(/\/$/, '')}/admin/queues`;
  const totalInQueue = counts.all ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading queues…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/admin/backoffice" className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Backoffice
            </Link>
            <span>/</span>
            <span>Job queues</span>
          </div>
          <h1 className="text-3xl font-bold font-display">Background queues</h1>
          <p className="text-muted-foreground mt-1">
            Monitor BullMQ jobs and retry failures. Bull Board shows the same Redis data — use the state filter here to match.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={bullBoardUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Bull Board UI
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadJobs()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load jobs: {loadError}. Super Admin access is required for this page.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Queue jobs</CardTitle>
              <CardDescription>
                {enabled
                  ? `QUEUES_ENABLED=true — ${totalInQueue} job(s) in ${selectedQueue}`
                  : 'QUEUES_ENABLED=false — synchronous mode (Redis jobs may still exist from earlier runs)'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={selectedQueue} onValueChange={setSelectedQueue}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Queue" />
                </SelectTrigger>
                <SelectContent>
                  {queues.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedState} onValueChange={(v) => setSelectedState(v as typeof selectedState)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{stateLabel(s, counts)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(selectedState === 'failed' || (counts.failed ?? 0) > 0) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleRetryAllFailed()}
                  disabled={retryingAll || (counts.failed ?? 0) === 0}
                >
                  {retryingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Retry all failed ({counts.failed ?? 0})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center space-y-2">
              <p>
                No {selectedState === 'all' ? '' : `${selectedState} `}jobs in {selectedQueue}
                {totalInQueue > 0 && selectedState !== 'all' ? ' with this filter' : ''}.
              </p>
              {totalInQueue > 0 && selectedState !== 'all' && (
                <Button variant="link" size="sm" onClick={() => setSelectedState('all')}>
                  Show all {totalInQueue} jobs in this queue
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="max-w-[240px]">Error / data</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={String(job.id)}>
                    <TableCell>
                      <p className="font-medium text-sm">{job.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">{job.id}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.state === 'failed' ? 'destructive' : 'secondary'}>{job.state}</Badge>
                    </TableCell>
                    <TableCell>
                      {(job.attemptsMade ?? 0)}/{job.maxAttempts ?? 5}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(job.timestamp)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                      {job.failedReason ?? (job.data ? JSON.stringify(job.data) : '—')}
                    </TableCell>
                    <TableCell>
                      {job.state === 'failed' && (
                        (job.attemptsMade ?? 0) >= (job.maxAttempts ?? 5) ? (
                          <span className="text-xs text-muted-foreground">Max retries</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleRetry(job)}
                            disabled={retryingId === String(job.id)}
                          >
                            {retryingId === String(job.id) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              'Retry'
                            )}
                          </Button>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Bull Board opens at <code className="text-foreground">{bullBoardUrl}</code>.
        Set <code className="text-foreground">BULL_BOARD_PASSWORD</code> in API env to protect it with basic auth.
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
