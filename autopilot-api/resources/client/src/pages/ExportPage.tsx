import React, { useState } from 'react';
import { leadsApi, contentItemsApi, auditLogsApi, chatbotApi, knowledgeApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Users, Image, CheckCircle2, Bot, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

type ExportStatus = 'idle' | 'loading' | 'done' | 'error';

interface ExportCard {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  color: string;
}

const EXPORTS: ExportCard[] = [
  {
    key: 'leads',
    label: 'Leads',
    description: 'All lead records including name, email, phone, source, classification, and created date.',
    icon: Users,
    permission: P.leads.export,
    color: 'text-blue-500',
  },
  {
    key: 'content',
    label: 'Generated Content',
    description: 'All content items: type, title, status, campaign theme, and created date.',
    icon: FileText,
    permission: P.content.view,
    color: 'text-purple-500',
  },
  {
    key: 'media',
    label: 'Media Library',
    description: 'Asset index with name, URL, type, file size, and upload date.',
    icon: Image,
    permission: P.media.view,
    color: 'text-green-500',
  },
  {
    key: 'audit',
    label: 'Audit Logs',
    description: 'Full audit trail: action, user, resource, and timestamp.',
    icon: FileSpreadsheet,
    permission: P.audit.view,
    color: 'text-amber-500',
  },
  {
    key: 'chatbot-sessions',
    label: 'Chatbot Sessions',
    description: 'Conversation sessions — channel, title, and last activity date.',
    icon: Bot,
    permission: P.chatbot.view,
    color: 'text-indigo-500',
  },
  {
    key: 'chatbot-knowledge',
    label: 'Knowledge Library',
    description: 'Uploaded documents with indexing status, chunk counts, and errors.',
    icon: BookOpen,
    permission: P.chatbot.view,
    color: 'text-teal-500',
  },
];

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v).replace(/"/g, '""');
  return `"${s}"`;
}
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.map(csvEscape).join(','), ...rows.map(r => headers.map(k => csvEscape(r[k])).join(','))].join('\n');
}
function download(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const { can }    = usePermissions();
  const { toast }  = useToast();
  const [status, setStatus] = useState<Record<string, ExportStatus>>({});

  async function runExport(key: string) {
    if (!tenant || !activeWorkspace) return;
    setStatus(s => ({ ...s, [key]: 'loading' }));
    try {
      let rows: Record<string, unknown>[] = [];
      const date = format(new Date(), 'yyyy-MM-dd');

      if (key === 'leads') {
        const all = await leadsApi.findAll();
        const list = (Array.isArray(all) ? all : []).filter(
          (r: Record<string, unknown>) => r.tenantId === tenant.id,
        );
        rows = list.map(r => ({
          id: r.id, name: r.name, email: r.email,
          source: r.source, classification: r.classification,
          status: r.status, created_at: r.created_at,
        }));
      } else if (key === 'content') {
        const all = await contentItemsApi.findAll();
        const list = (Array.isArray(all) ? all : []).filter(
          (r: Record<string, unknown>) => r.tenantId === tenant.id,
        );
        rows = list.map(r => ({
          id: r.id, content_type: r.contentType, title: r.title,
          status: r.status, campaign_theme: r.campaignTheme,
          content: String(r.content ?? '').slice(0, 500), created_at: r.created_at,
        }));
      } else if (key === 'media') {
        rows = [];
      } else if (key === 'audit') {
        const res = await auditLogsApi.findAll({ tenantId: tenant.id });
        const list = Array.isArray(res) ? res : (res as { items?: unknown[] })?.items ?? [];
        rows = (list as Record<string, unknown>[]).map(r => ({
          id: r.id, action: r.action, user_id: r.userId ?? r.user_id,
          resource_type: r.resourceType ?? r.resource_type,
          resource_id: r.resourceId ?? r.resource_id,
          metadata: JSON.stringify(r.metadata), created_at: r.created_at,
        }));
      } else if (key === 'chatbot-sessions') {
        const list = await chatbotApi.listSessions(tenant.id, undefined, activeWorkspace);
        rows = list.map((s) => ({
          id: s.id,
          channel: s.channel,
          title: s.title ?? '',
          last_message_at: s.lastMessageAt ?? '',
          created_at: s.created_at,
        }));
      } else if (key === 'chatbot-knowledge') {
        const list = await knowledgeApi.list(tenant.id, activeWorkspace);
        rows = list.map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          chunk_count: d.chunkCount,
          mime_type: d.mimeType ?? '',
          error_message: d.errorMessage ?? '',
          created_at: d.created_at,
        }));
      }

      if (!rows.length) {
        toast({ title: 'Nothing to export', description: 'No records found for this dataset.' });
        setStatus(s => ({ ...s, [key]: 'idle' }));
        return;
      }

      download(toCsv(rows), `${tenant.slug}-${key}-${date}.csv`);
      await logAudit({ tenantId: tenant.id, action: `${key}.export`, metadata: { count: rows.length } });
      setStatus(s => ({ ...s, [key]: 'done' }));
      toast({ title: 'Export ready', description: `${rows.length} records downloaded.` });
      setTimeout(() => setStatus(s => ({ ...s, [key]: 'idle' })), 3000);
    } catch (e: any) {
      setStatus(s => ({ ...s, [key]: 'error' }));
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
      <div className="flex items-center gap-3">
        <Download className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Data Export</h1>
          <p className="text-sm text-muted-foreground">Download your tenant data as CSV files. All exports are scoped to {tenant?.name}.</p>
        </div>
      </div>

      <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-300">
        Exports contain all data for <strong>{tenant?.name}</strong>. Store securely and in accordance with your data retention policy.
      </div>

      <div className="grid gap-4">
        {EXPORTS.map(exp => {
          if (!can(exp.permission)) return null;
          const st = status[exp.key] ?? 'idle';
          return (
            <div key={exp.key} className="rounded-lg border bg-card p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 ${exp.color}`}>
                  <exp.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">{exp.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{exp.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant={st === 'done' ? 'outline' : 'default'}
                className={`shrink-0 gap-1.5 ${st === 'done' ? 'text-green-600 border-green-300' : ''}`}
                disabled={st === 'loading'}
                onClick={() => runExport(exp.key)}
              >
                {st === 'loading' ? (
                  <><span className="animate-spin">⟳</span> Exporting…</>
                ) : st === 'done' ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Downloaded</>
                ) : (
                  <><Download className="h-3.5 w-3.5" /> Export CSV</>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
