import React, { useEffect, useState } from 'react';
import { auditLogsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PermissionGate } from '@/components/PermissionGate';
import { ClipboardList, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string; action: string; resource_type: string | null; resource_id: string | null;
  before_state: Record<string,unknown> | null; after_state: Record<string,unknown> | null;
  metadata: Record<string,unknown> | null; created_at: string;
  profiles?: { full_name: string | null; email: string | null };
}

const ACTION_COLORS: Record<string, string> = {
  'content.approved':  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'content.published': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'content.deleted':   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'team.invite':       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'team.member_removed':'bg-orange-100 text-orange-700',
  'media.delete':      'bg-red-100 text-red-700',
  'approval.approved': 'bg-green-100 text-green-700',
  'approval.rejected': 'bg-red-100 text-red-700',
  'http': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const PAGE_SIZE = 25;
const MODULES = ['all','http','content','leads','media','templates','replies','team','approval','reply_rule'];

export default function AuditLogsPage() {
  const { tenant } = useTenant();
  const { can }    = usePermissions();
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [search, setSearch]   = useState('');
  const [module, setModule]   = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (tenant) load(); }, [tenant, page, search, module]);

  async function load() {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await auditLogsApi.findAll({
        tenantId: tenant.id,
        search: search.trim() || undefined,
        module: module !== 'all' ? module : undefined,
        page,
        take: PAGE_SIZE,
      });
      if (Array.isArray(res)) {
        setLogs((res as AuditLog[]) ?? []);
        setTotal(res.length);
      } else {
        setLogs((res.items as AuditLog[]) ?? []);
        setTotal(res.total ?? 0);
      }
    } catch {
      setLogs([]);
      setTotal(0);
    }
    setLoading(false);
  }

  function exportCsv() {
    const header = 'timestamp,user,action,resource_type,resource_id,metadata';
    const rows = logs.map(l => [
      l.created_at,
      (l.profiles as any)?.email ?? 'system',
      l.action,
      l.resource_type ?? '',
      l.resource_id ?? '',
      JSON.stringify(l.metadata ?? {}),
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `audit-${tenant?.slug}-${format(new Date(),'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <PermissionGate require={P.audit.view} fallback={true}>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-primary"/>
            <div>
              <h1 className="text-2xl font-semibold">Audit Logs</h1>
              <p className="text-sm text-muted-foreground">Immutable record of all actions taken in {tenant?.name}.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1">
            <Download className="h-4 w-4"/> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-9" placeholder="Search action…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Select value={module} onValueChange={v => { setModule(v); setPage(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All modules"/>
            </SelectTrigger>
            <SelectContent>
              {MODULES.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Log table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Timestamp</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">User</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Action</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Resource</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                Array.from({length:8}).map((_,i) => (
                  <tr key={i}>
                    {Array.from({length:5}).map((_,j) => (
                      <td key={j} className="p-3"><div className="h-4 bg-muted rounded animate-pulse w-24"/></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-muted-foreground text-sm">No audit events found.</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss')}
                  </td>
                  <td className="p-3">
                    <p className="text-xs font-medium">{(log.profiles as any)?.full_name ?? 'System'}</p>
                    <p className="text-[10px] text-muted-foreground">{(log.profiles as any)?.email}</p>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium font-mono
                      ${ACTION_COLORS[log.action] ?? (log.action.startsWith('http.') ? ACTION_COLORS.http : 'bg-muted text-muted-foreground')}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {log.resource_type && <p className="font-medium">{log.resource_type}</p>}
                    {log.resource_id && <p className="font-mono text-[10px]">{log.resource_id.slice(0,8)}…</p>}
                  </td>
                  <td className="p-3">
                    {log.after_state && (
                      <pre className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(log.after_state)}
                      </pre>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(log.metadata)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>{total} total events · Page {page + 1} of {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4"/>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}>
                <ChevronRight className="h-4 w-4"/>
              </Button>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
