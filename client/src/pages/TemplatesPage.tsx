import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Copy, ImageIcon, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { templatesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { DataPagination } from '@/components/DataPagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CHANNEL_LABEL, CHANNEL_SWATCH, templateChannel } from '@/components/templates/channels';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  contentType: string | null;
  body: string | null;
  platforms: string[] | null;
  mediaUrls?: string[] | null;
  isActive: boolean;
  created_at: string;
  updated_at?: string;
}

export default function TemplatesPage() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);

  const load = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const rows = await templatesApi.findAll(tenant.id, activeWorkspace);
      setTemplates(Array.isArray(rows) ? (rows as Template[]) : []);
    } catch (e) {
      setTemplates([]);
      toast({ title: 'Could not load templates', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant, activeWorkspace, toast]);

  useEffect(() => {
    void load();
    // workspaceVersion bumps on a workspace switch.
  }, [load, workspaceVersion]);

  /** The AI uses the most recently updated active template for a channel; the list is newest first. */
  const defaults = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const t of templates) {
      const ch = templateChannel(t);
      if (t.isActive && !seen.has(ch)) {
        seen.add(ch);
        ids.add(t.id);
      }
    }
    return ids;
  }, [templates]);

  const channels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of templates) counts.set(templateChannel(t), (counts.get(templateChannel(t)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => (CHANNEL_LABEL[a[0]] ?? a[0]).localeCompare(CHANNEL_LABEL[b[0]] ?? b[0]));
  }, [templates]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (channel !== 'all' && templateChannel(t) !== channel) return false;
      if (!q) return true;
      return [t.name, t.description ?? '', t.body ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [templates, channel, query]);

  // Back to the first page whenever the list changes shape.
  useEffect(() => {
    setPage(0);
  }, [channel, query, pageSize]);

  // Stay on a real page after a delete shrinks the list.
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const pageItems = useMemo(() => visible.slice(page * pageSize, (page + 1) * pageSize), [visible, page, pageSize]);

  async function toggleActive(t: Template) {
    if (!can(P.templates.activate) || !tenant || !activeWorkspace) return;
    setBusyId(t.id);
    setTemplates((list) => list.map((x) => (x.id === t.id ? { ...x, isActive: !x.isActive } : x)));
    try {
      await templatesApi.update(t.id, tenant.id, { isActive: !t.isActive }, activeWorkspace);
      await load();
    } catch (e) {
      setTemplates((list) => list.map((x) => (x.id === t.id ? { ...x, isActive: t.isActive } : x)));
      toast({ title: 'Update failed', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(t: Template) {
    if (!tenant || !activeWorkspace) return;
    try {
      await templatesApi.create({
        tenantId: tenant.id,
        workspaceId: activeWorkspace,
        name: `${t.name} (copy)`,
        description: t.description,
        contentType: t.contentType,
        body: t.body,
        platforms: t.platforms,
        mediaUrls: t.mediaUrls ?? [],
        isActive: false,
      });
      toast({ title: 'Template duplicated', description: 'The copy is off until you turn it on.' });
      await load();
    } catch (e) {
      toast({ title: 'Duplicate failed', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
  }

  async function confirmDelete() {
    const t = deleting;
    if (!t || !tenant || !activeWorkspace) return;
    try {
      await templatesApi.remove(t.id, tenant.id, activeWorkspace);
      toast({ title: 'Template deleted' });
      setDeleting(null);
      await load();
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <PermissionGate require={P.templates.view} fallback={true}>
      <div className="w-full min-w-0 space-y-6 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Templates</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              The instructions AI follows when it writes for each channel. The newest active template for a channel is used by default.
            </p>
          </div>
          <PermissionGate require={P.templates.create}>
            <Button asChild className="gap-1.5 self-start sm:self-auto">
              <Link to="/templates/new"><Plus className="h-4 w-4" /> New template</Link>
            </Button>
          </PermissionGate>
        </div>

        {!loading && templates.length > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
              {[['all', templates.length] as [string, number], ...channels].map(([key, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChannel(key)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    channel === key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {key !== 'all' && <span className={cn('h-2 w-2 rounded-sm', CHANNEL_SWATCH[key] ?? 'bg-muted-foreground')} aria-hidden />}
                  {key === 'all' ? 'All' : CHANNEL_LABEL[key] ?? key}
                  <span className={cn('tabular-nums', channel === key ? 'text-background/60' : 'text-muted-foreground/70')}>{count}</span>
                </button>
              ))}
            </div>
            <div className="relative shrink-0 md:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates"
                aria-label="Search templates"
                className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl border bg-card/60" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center">
            <h3 className="font-display text-lg font-semibold">No templates yet</h3>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              A template tells AI how to write for a channel: structure, tone, length and hashtags. Start with the channel you post on most.
            </p>
            {can(P.templates.create) && (
              <Button asChild className="mt-5 gap-1.5"><Link to="/templates/new"><Plus className="h-4 w-4" /> New template</Link></Button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">No templates match.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((t) => {
              const ch = templateChannel(t);
              const isDefault = defaults.has(t.id);
              const media = t.mediaUrls?.length ?? 0;
              const editable = can(P.templates.edit);
              return (
                <li
                  key={t.id}
                  className={cn(
                    'group relative flex flex-col rounded-2xl border bg-card transition-shadow hover:shadow-md',
                    !t.isActive && 'bg-card/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-3 px-5 pt-5">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      <span className={cn('h-2 w-2 rounded-sm', CHANNEL_SWATCH[ch] ?? 'bg-muted-foreground')} aria-hidden />
                      {CHANNEL_LABEL[ch] ?? ch}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 -mt-1.5 h-8 w-8" aria-label={`Options for ${t.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {editable && (
                          <DropdownMenuItem onClick={() => navigate(`/templates/${t.id}`)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                        )}
                        {can(P.templates.create) && (
                          <DropdownMenuItem onClick={() => void duplicate(t)}>
                            <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                          </DropdownMenuItem>
                        )}
                        {can(P.templates.delete) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleting(t)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {editable ? (
                    <Link to={`/templates/${t.id}`} className="block px-5 pt-2 focus-visible:outline-none">
                      <h3 className="font-display text-base font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">{t.name}</h3>
                    </Link>
                  ) : (
                    <h3 className="px-5 pt-2 font-display text-base font-semibold leading-snug">{t.name}</h3>
                  )}
                  {t.description && <p className="mt-1 line-clamp-2 px-5 text-sm text-muted-foreground">{t.description}</p>}

                  <blockquote className="mx-5 mb-5 mt-4 border-l-2 border-border pl-3 text-xs leading-relaxed text-foreground/70">
                    <span className="line-clamp-4">{t.body?.trim() || 'No instructions yet.'}</span>
                  </blockquote>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t px-5 py-3">
                    <div
                      className="flex min-w-0 items-center gap-3 text-[11px] text-muted-foreground"
                      title={t.updated_at ? `Edited ${formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}` : undefined}
                    >
                      {isDefault ? (
                        <span className="whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">Default</span>
                      ) : t.isActive ? (
                        <span title="Pick it when writing a post to use it">Available to pick</span>
                      ) : (
                        <span>Off</span>
                      )}
                      {media > 0 && (
                        <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" />{media}</span>
                      )}
                    </div>
                    {can(P.templates.activate) && (
                      <Switch
                        checked={t.isActive}
                        disabled={busyId === t.id}
                        onCheckedChange={() => void toggleActive(t)}
                        aria-label={t.isActive ? `Turn off ${t.name}` : `Turn on ${t.name}`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && visible.length > 0 && (
          <DataPagination
            page={page}
            pageSize={pageSize}
            total={visible.length}
            noun={visible.length === 1 ? 'template' : 'templates'}
            pageSizes={[12, 24, 48]}
            onPageSizeChange={setPageSize}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              AI will stop using it straight away. Posts already written with it aren’t affected. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  );
}
