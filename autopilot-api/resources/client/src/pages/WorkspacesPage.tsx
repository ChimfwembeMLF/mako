import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Check,
  ImageIcon,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { workspacesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Workspace = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? 'WS').toUpperCase();
}

export default function WorkspacesPage() {
  const { tenant } = useTenant();
  const { activeWorkspace, setActiveWorkspace, refetch: refetchWorkspaceContext } = useWorkspace();
  const { toast } = useToast();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await workspacesApi.findAll(tenant.id);
      setWorkspaces(Array.isArray(data) ? (data as Workspace[]) : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load workspaces';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant, toast]);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  function resetForm() {
    setName('');
    setSlug('');
    setLogoUrl('');
    setSlugTouched(false);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(ws: Workspace) {
    setEditingId(ws.id);
    setName(ws.name);
    setSlug(ws.slug);
    setLogoUrl(ws.logoUrl ?? '');
    setSlugTouched(true);
    setShowForm(true);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!editingId && !slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !name.trim() || !slug.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        await workspacesApi.update(editingId, {
          name: name.trim(),
          slug: slug.trim(),
          logoUrl: logoUrl.trim() || undefined,
        });
        toast({ title: 'Workspace updated' });
      } else {
        const created = await workspacesApi.create({
          tenantId: tenant.id,
          name: name.trim(),
          slug: slug.trim(),
          logoUrl: logoUrl.trim() || undefined,
        });
        toast({ title: 'Workspace created' });
        if (created?.id) setActiveWorkspace(String(created.id));
      }
      resetForm();
      await fetchWorkspaces();
      await refetchWorkspaceContext();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await workspacesApi.remove(deleteTarget.id);
      toast({ title: 'Workspace deleted' });
      if (activeWorkspace === deleteTarget.id) {
        const remaining = workspaces.filter((w) => w.id !== deleteTarget.id);
        if (remaining[0]) setActiveWorkspace(remaining[0].id);
      }
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      await fetchWorkspaces();
      await refetchWorkspaceContext();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
            <Layers className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Workspaces</h1>
            <p className="text-muted-foreground text-sm mt-0.5 max-w-lg">
              Separate brands, clients, or business units. Brand Brain, content, and publisher
              connections are scoped to the active workspace.
            </p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={startCreate} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            New workspace
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl border border-border/50 bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                  <Building2 className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold font-display">No workspaces yet</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                  Create your first workspace to organize Brand Brain, content, and social accounts
                  by brand or client.
                </p>
                <Button onClick={startCreate} className="mt-6 gap-2">
                  <Plus className="h-4 w-4" />
                  Create workspace
                </Button>
              </CardContent>
            </Card>
          ) : (
            workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspace;
              return (
                <Card
                  key={ws.id}
                  className={cn(
                    'border-border/50 transition-all',
                    isActive && 'border-primary/40 ring-1 ring-primary/20 shadow-sm',
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold overflow-hidden',
                          isActive
                            ? 'gradient-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {ws.logoUrl ? (
                          <img
                            src={ws.logoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          workspaceInitials(ws.name)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold truncate">{ws.name}</h3>
                          {isActive && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 gap-1">
                              <Check className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{ws.slug}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Brand Brain · Content · Publisher · Chatbot
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                        {!isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setActiveWorkspace(ws.id)}
                          >
                            Switch
                          </Button>
                        )}
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => startEdit(ws)}
                            aria-label={`Edit ${ws.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(ws)}
                            aria-label={`Delete ${ws.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {showForm && (
          <div className="lg:col-span-2">
            <Card className="border-border/50 sticky top-4">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold font-display">
                      {editingId ? 'Edit workspace' : 'New workspace'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {editingId
                        ? 'Update name, slug, or logo.'
                        : 'Each workspace gets its own Brand Brain and content.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={resetForm}
                    aria-label="Close form"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ws-name">Name</Label>
                    <Input
                      id="ws-name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Marketing"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ws-slug">Slug</Label>
                    <Input
                      id="ws-slug"
                      value={slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(e.target.value);
                      }}
                      placeholder="marketing"
                      required
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">URL-safe identifier</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ws-logo">Logo URL</Label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="ws-logo"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://…"
                        className="pl-9"
                      />
                    </div>
                    {logoUrl.trim() && (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                        <img
                          src={logoUrl.trim()}
                          alt="Logo preview"
                          className="h-8 w-8 rounded-md object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = 'hidden';
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Logo preview</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button type="submit" disabled={saving || !tenant} className="flex-1 gap-2">
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : editingId ? (
                        'Save changes'
                      ) : (
                        'Create workspace'
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the workspace and its scoped Brand Brain profile. Content and connected
              accounts tied to this workspace may be affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Deleting…' : 'Delete workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
