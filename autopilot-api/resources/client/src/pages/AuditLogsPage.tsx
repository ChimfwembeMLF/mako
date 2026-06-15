import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Filter,
  Search,
  Shield,
} from 'lucide-react';
import { auditLogsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PermissionGate } from '@/components/PermissionGate';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null };
}

const ACTION_STYLES: Record<string, string> = {
  'content.approved': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'content.published': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  'content.deleted': 'bg-red-500/10 text-red-700 border-red-500/20',
  'team.invite': 'bg-violet-500/10 text-violet-700 border-violet-500/20',
  'team.member_removed': 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  'media.delete': 'bg-red-500/10 text-red-700 border-red-500/20',
  'approval.approved': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'approval.rejected': 'bg-red-500/10 text-red-700 border-red-500/20',
  http: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
};

const PAGE_SIZE = 25;
const MODULES = [
  'all',
  'http',
  'content',
  'leads',
  'media',
  'templates',
  'replies',
  'team',
  'approval',
  'reply_rule',
] as const;

function actionStyle(action: string): string {
  if (ACTION_STYLES[action]) return ACTION_STYLES[action];
  if (action.startsWith('http.')) return ACTION_STYLES.http;
  return 'bg-muted text-muted-foreground border-border/60';
}

function actionModule(action: string): string {
  return action.split('.')[0] ?? 'other';
}

function formatJsonBlock(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function AuditLogCard({ log, expanded, onToggle }: {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const profile = log.profiles;
  const hasDetails =
    Boolean(log.after_state) ||
    Boolean(log.before_state) ||
    Boolean(log.metadata && Object.keys(log.metadata).length > 0);

  return (
    <Card className="border-border/50 overflow-hidden transition-shadow hover:shadow-sm">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasDetails}
          className={cn(
            'w-full text-left p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4',
            hasDetails && 'cursor-pointer hover:bg-muted/30 transition-colors',
            !hasDetails && 'cursor-default',
          )}
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-semibold">
              {(profile?.full_name ?? 'SY').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('font-mono text-[10px] border', actionStyle(log.action))}
                >
                  {log.action}
                </Badge>
                <span className="text-[11px] text-muted-foreground capitalize">
                  {actionModule(log.action)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {profile?.full_name ?? 'System'}
                </span>
                {profile?.email && <span>{profile.email}</span>}
                <span title={format(new Date(log.created_at), 'PPpp')}>
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </span>
              </div>
              {(log.resource_type || log.resource_id) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {log.resource_type && (
                    <span className="rounded-md bg-muted/60 px-2 py-0.5 font-medium">
                      {log.resource_type}
                    </span>
                  )}
                  {log.resource_id && (
                    <span className="rounded-md bg-muted/40 px-2 py-0.5 font-mono text-[10px]">
                      {log.resource_id}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {hasDetails && (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform self-end sm:self-center',
                expanded && 'rotate-180',
              )}
            />
          )}
        </button>

        {expanded && hasDetails && (
          <div className="border-t border-border/50 bg-muted/20 px-4 py-3 space-y-3">
            {log.before_state && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Before
                </p>
                <pre className="text-[11px] leading-relaxed overflow-x-auto rounded-lg bg-background/80 border border-border/50 p-3 max-h-40">
                  {formatJsonBlock(log.before_state)}
                </pre>
              </div>
            )}
            {log.after_state && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  After
                </p>
                <pre className="text-[11px] leading-relaxed overflow-x-auto rounded-lg bg-background/80 border border-border/50 p-3 max-h-40">
                  {formatJsonBlock(log.after_state)}
                </pre>
              </div>
            )}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Metadata
                </p>
                <pre className="text-[11px] leading-relaxed overflow-x-auto rounded-lg bg-background/80 border border-border/50 p-3 max-h-40">
                  {formatJsonBlock(log.metadata)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuditLogsPage() {
  const { tenant } = useTenant();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [module, setModule] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await auditLogsApi.findAll({
        tenantId: tenant.id,
        search: searchQuery || undefined,
        module: module !== 'all' ? module : undefined,
        page,
        take: PAGE_SIZE,
      });
      if (Array.isArray(res)) {
        setLogs(res as AuditLog[]);
        setTotal(res.length);
      } else {
        setLogs((res.items as AuditLog[]) ?? []);
        setTotal(res.total ?? 0);
      }
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenant, searchQuery, module, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, module]);

  function exportCsv() {
    const header = 'timestamp,user,action,resource_type,resource_id,metadata';
    const rows = logs.map((l) =>
      [
        l.created_at,
        l.profiles?.email ?? 'system',
        l.action,
        l.resource_type ?? '',
        l.resource_id ?? '',
        JSON.stringify(l.metadata ?? {}),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${tenant?.slug}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      const key = actionModule(log.action);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [logs]);

  return (
    <PermissionGate require={P.audit.view} fallback={true}>
      <div className="max-w-5xl mx-auto space-y-8 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
              <ClipboardList className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display">Audit Logs</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Immutable activity trail for {tenant?.name ?? 'your organization'}.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!logs.length} className="gap-2 shrink-0">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total events</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold tabular-nums">{logs.length}</p>
              <p className="text-xs text-muted-foreground">On this page</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold tabular-nums">{Object.keys(moduleCounts).length}</p>
              <p className="text-xs text-muted-foreground">Modules represented</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search actions, resources, users…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m === 'all' ? 'All modules' : m.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-border/50 bg-muted/30 animate-pulse" />
            ))
          ) : logs.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-16 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="font-medium">No audit events found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different search or module filter.
                </p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log) => (
              <AuditLogCard
                key={log.id}
                log={log}
                expanded={expandedId === log.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === log.id ? null : log.id))
                }
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
            <p>
              {total.toLocaleString()} events · Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
