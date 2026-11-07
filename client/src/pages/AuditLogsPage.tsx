import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ChevronDown, Download, Loader2, Search } from 'lucide-react';
import { auditLogsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PermissionGate } from '@/components/PermissionGate';
import { DataPagination } from '@/components/DataPagination';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const RANGES = [
  { key: '1d', label: '24 hours', ms: 864e5 },
  { key: '7d', label: '7 days', ms: 7 * 864e5 },
  { key: '30d', label: '30 days', ms: 30 * 864e5 },
  { key: 'all', label: 'All time', ms: 0 },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const EXPORT_LIMIT = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Readable names for API areas whose path doesn't say it well. */
const AREA_NAMES: Record<string, string> = {
  'tenant-members/invitations': 'team invitation',
  'tenant-members': 'team member',
  'content-items': 'post',
  'content-ai': 'AI content',
  'media/upload': 'media',
  'whatsapp/bots': 'WhatsApp bot',
  'ai/form-suggestions': 'AI suggestion',
  'brand-profiles': 'brand voice',
  'approval-requests': 'approval request',
  'comment-replies': 'comment reply',
  'auto-reply-rules': 'reply rule',
  'social-accounts': 'social account',
  'ads/campaigns': 'ad campaign',
  'audit-logs': 'audit entry',
  workspaces: 'workspace',
  templates: 'template',
  leads: 'lead',
  roles: 'role',
};

/** Section names shown under each event. */
const SECTION: Record<string, string> = {
  'tenant-members': 'Team',
  whatsapp: 'WhatsApp',
  'whatsapp-templates': 'WhatsApp',
  'content-items': 'Posts',
  'content-ai': 'Posts',
  'brand-profiles': 'Brand voice',
  'social-accounts': 'Social accounts',
  'comment-replies': 'Inbox',
  inbox: 'Inbox',
  mail: 'Email',
  ai: 'AI',
  auth: 'Account',
  rbac: 'Roles',
  roles: 'Roles',
  'approval-requests': 'Approvals',
  'auto-reply-rules': 'Reply rules',
};

/** Exact requests that deserve their own wording. */
const REQUEST_TITLES: Record<string, string> = {
  'POST tenant-members/invite': 'Invited a team member',
  'POST tenant-members/invitations/accept': 'Accepted a team invitation',
  'DELETE tenant-members/invitations': 'Cancelled a team invitation',
  'POST whatsapp/bots/test': 'Tested a WhatsApp bot',
  'POST ai/form-suggestions': 'Asked AI for form suggestions',
  'POST media/upload': 'Uploaded media',
  'POST auth/logout': 'Signed out',
};

const NAMED: Record<string, string> = {
  'team.invite': 'Invited a team member',
  'team.invite_revoked': 'Cancelled a team invitation',
  'team.member_removed': 'Removed a team member',
  'team.role_changed': 'Changed a member’s role',
  'content.approved': 'Approved a post',
  'content.published': 'Published a post',
  'content.deleted': 'Deleted a post',
  'approval.approved': 'Approved a request',
  'approval.rejected': 'Rejected a request',
  'media.delete': 'Deleted media',
};

const VERB: Record<string, { word: string; tone: string }> = {
  POST: { word: 'Created', tone: 'bg-emerald-500' },
  PUT: { word: 'Updated', tone: 'bg-sky-500' },
  PATCH: { word: 'Updated', tone: 'bg-sky-500' },
  DELETE: { word: 'Deleted', tone: 'bg-rose-500' },
  GET: { word: 'Viewed', tone: 'bg-muted-foreground/40' },
};

/** Turns "http.POST /api/v1/whatsapp/bots/…" into "Created WhatsApp bot", and named actions into a sentence. */
function describe(log: AuditLog): { title: string; area: string; dot: string; path?: string } {
  const http = log.action.match(/^http\.([A-Z]+)\s+(\S+)/);
  if (http) {
    const [, method, rawPath] = http;
    const path = rawPath.replace(/^\/api\/v\d+\//, '').split('?')[0];
    const parts = path.split('/').filter((p) => p && !UUID.test(p) && !/^\d+$/.test(p));
    const key2 = parts.slice(0, 2).join('/');
    const verb = VERB[method] ?? { word: method, tone: 'bg-muted-foreground/40' };
    const section = SECTION[parts[0] ?? ''] ?? (parts[0] ?? 'API').replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    const exact = REQUEST_TITLES[`${method} ${parts.join('/')}`] ?? REQUEST_TITLES[`${method} ${key2}`];
    if (exact) return { title: exact, area: section, dot: verb.tone, path: rawPath };

    const area =
      AREA_NAMES[key2] ?? AREA_NAMES[parts[0] ?? ''] ?? (parts[parts.length - 1] ?? 'item').replace(/[-_]/g, ' ').replace(/s$/, '');
    // A trailing word after the record (e.g. /campaigns/:id/publish) is the action taken.
    const action = parts.length > 2 || (parts.length === 2 && !AREA_NAMES[key2]) ? parts[parts.length - 1] : null;
    const title =
      action && method === 'POST' && !/^(upload|create)$/.test(action)
        ? `${action.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())} · ${area}`
        : `${verb.word} ${area}`;
    return { title, area: section, dot: verb.tone, path: rawPath };
  }
  const [module, ...rest] = log.action.split('.');
  const title =
    NAMED[log.action] ??
    `${module.replace(/^\w/, (c) => c.toUpperCase())} ${rest.join(' ').replace(/[_-]/g, ' ')}`.trim();
  const dot = /delete|remov|reject|revok/.test(log.action)
    ? 'bg-rose-500'
    : /approv|publish|creat|invite/.test(log.action)
      ? 'bg-emerald-500'
      : 'bg-sky-500';
  return { title, area: SECTION[module] ?? module.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), dot };
}

function statusOf(log: AuditLog): number | null {
  const code = Number(log.metadata?.statusCode);
  return Number.isFinite(code) && code > 0 ? code : null;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE d MMMM yyyy');
}

function json(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function actorName(log: AuditLog): string {
  return log.profiles?.full_name || log.profiles?.email || 'System';
}

function Row({ log, open, onToggle }: { log: AuditLog; open: boolean; onToggle: () => void }) {
  const d = describe(log);
  const status = statusOf(log);
  const failed = status !== null && status >= 400;
  const name = actorName(log);
  const duration = Number(log.metadata?.durationMs);

  return (
    <li className={cn(open && 'bg-muted/30')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[64px_minmax(0,1fr)_200px_auto] sm:px-5"
      >
        <span className="text-xs tabular-nums text-muted-foreground">{format(new Date(log.created_at), 'HH:mm')}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', failed ? 'bg-destructive' : d.dot)} aria-hidden />
            <span className="truncate text-sm font-medium">{d.title}</span>
            {failed && (
              <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-px text-[10px] font-semibold text-destructive">
                Failed · {status}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate pl-3.5 text-xs text-muted-foreground sm:hidden">{name}</span>
          <span className="mt-0.5 hidden truncate pl-3.5 text-xs text-muted-foreground sm:block">{d.area}</span>
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm">{name}</span>
          {log.profiles?.email && log.profiles.full_name && (
            <span className="block truncate text-xs text-muted-foreground">{log.profiles.email}</span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/60 px-4 pb-5 pt-4 sm:px-5 sm:pl-[84px]">
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">When</dt>
            <dd>{format(new Date(log.created_at), "EEE d MMM yyyy 'at' HH:mm:ss")}</dd>
            <dt className="text-muted-foreground">Who</dt>
            <dd className="truncate">{name}{log.profiles?.email && log.profiles.full_name ? ` · ${log.profiles.email}` : ''}</dd>
            {d.path && (<><dt className="text-muted-foreground">Request</dt><dd className="break-all font-mono text-[11px]">{log.action.replace(/^http\./, '')}</dd></>)}
            {status !== null && (<><dt className="text-muted-foreground">Result</dt><dd className={cn(failed && 'text-destructive')}>{status}{Number.isFinite(duration) ? ` · ${duration} ms` : ''}</dd></>)}
            {log.resource_id && (<><dt className="text-muted-foreground">Record</dt><dd className="break-all font-mono text-[11px]">{log.resource_type ? `${log.resource_type} · ` : ''}{log.resource_id}</dd></>)}
            {log.ip_address && (<><dt className="text-muted-foreground">IP address</dt><dd className="font-mono text-[11px]">{log.ip_address}</dd></>)}
            <dt className="text-muted-foreground">Raw action</dt>
            <dd className="break-all font-mono text-[11px] text-muted-foreground">{log.action}</dd>
          </dl>

          {(log.before_state || log.after_state) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {[
                ['Before', log.before_state],
                ['After', log.after_state],
              ].map(([label, value]) =>
                value ? (
                  <div key={label as string} className="min-w-0">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label as string}</p>
                    <pre className="max-h-56 overflow-auto rounded-lg border bg-background p-3 text-[11px] leading-relaxed">{json(value)}</pre>
                  </div>
                ) : null,
              )}
            </div>
          )}

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <details className="group">
              <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded-lg border bg-background p-3 text-[11px] leading-relaxed">{json(log.metadata)}</pre>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

export default function AuditLogsPage() {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [range, setRange] = useState<RangeKey>('30d');
  const [changesOnly, setChangesOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Recomputed per load so "last 24 hours" moves with the clock.
  const filters = useCallback(() => {
    const r = RANGES.find((x) => x.key === range);
    return {
      tenantId: tenant?.id,
      search: searchQuery || undefined,
      kind: changesOnly ? ('changes' as const) : ('all' as const),
      from: r && r.ms ? new Date(Date.now() - r.ms).toISOString() : undefined,
    };
  }, [tenant?.id, searchQuery, changesOnly, range]);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await auditLogsApi.findAll({ ...filters(), page, take: pageSize });
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
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [tenant, filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, changesOnly, range, pageSize]);

  const groups = useMemo(() => {
    const out: Array<{ day: string; items: AuditLog[] }> = [];
    for (const log of logs) {
      const day = dayLabel(log.created_at);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(log);
      else out.push({ day, items: [log] });
    }
    return out;
  }, [logs]);

  /** Exports every matching event (up to EXPORT_LIMIT), not just this page. */
  async function exportCsv() {
    if (!tenant) return;
    setExporting(true);
    try {
      const all: AuditLog[] = [];
      for (let p = 0; all.length < Math.min(total, EXPORT_LIMIT); p++) {
        const res = await auditLogsApi.findAll({ ...filters(), page: p, take: 100 });
        const items = (Array.isArray(res) ? res : res.items) as AuditLog[];
        if (!items?.length) break;
        all.push(...items);
      }
      const header = 'timestamp,user,email,event,action,status,resource_type,resource_id,ip_address';
      const rows = all.slice(0, EXPORT_LIMIT).map((l) =>
        [
          l.created_at,
          l.profiles?.full_name ?? '',
          l.profiles?.email ?? 'system',
          describe(l).title,
          l.action,
          statusOf(l) ?? '',
          l.resource_type ?? '',
          l.resource_id ?? '',
          l.ip_address ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
      const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${tenant.slug ?? 'log'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: `Exported ${rows.length.toLocaleString()} events`,
        description: total > EXPORT_LIMIT ? `Only the newest ${EXPORT_LIMIT.toLocaleString()} are included. Narrow the dates to export older ones.` : undefined,
      });
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <PermissionGate require={P.audit.view} fallback={true}>
      <div className="w-full min-w-0 space-y-6 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Audit log</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Everything people and systems changed in {tenant?.name ?? 'your organization'}. Entries can’t be edited or removed.
            </p>
          </div>
          <Button variant="outline" onClick={() => void exportCsv()} disabled={!total || exporting} className="gap-1.5 self-start sm:self-auto">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by action, area, name or email"
              aria-label="Search the audit log"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border bg-background p-0.5" role="group" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  aria-pressed={range === r.key}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    range === r.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={changesOnly} onCheckedChange={setChangesOnly} aria-label="Changes only" />
              Changes only
            </label>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-3 w-10 animate-pulse rounded bg-muted" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
                  <div className="hidden h-3 w-32 animate-pulse rounded bg-muted sm:block" />
                </div>
              ))}
            </div>
          ) : failed ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium">Couldn’t load the audit log</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>Try again</Button>
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium">No events match</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {changesOnly ? 'Try a longer time range, or turn off “Changes only” to include page views.' : 'Try a longer time range or a different search.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[64px_minmax(0,1fr)_200px_16px] gap-3 border-b px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                <span>Time</span>
                <span>Event</span>
                <span>By</span>
                <span />
              </div>
              {groups.map((g) => (
                <section key={g.day}>
                  <h2 className="border-b bg-muted/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">
                    {g.day}
                  </h2>
                  <ul className="divide-y divide-border/60">
                    {g.items.map((log) => (
                      <Row key={log.id} log={log} open={openId === log.id} onToggle={() => setOpenId((p) => (p === log.id ? null : log.id))} />
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>

        <DataPagination
          page={page}
          pageSize={pageSize}
          total={total}
          noun="events"
          onPageChange={(p) => {
            setPage(p);
            setOpenId(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSizeChange={setPageSize}
        />
      </div>
    </PermissionGate>
  );
}
