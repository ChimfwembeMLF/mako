import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Building2,
  Check,
  ImagePlus,
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
import { mediaApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { WorkspaceLogo } from '@/components/WorkspaceLogo';

type Workspace = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
};

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function WorkspacesPage() {
  const { tenant } = useTenant();
  const { activeWorkspace, setActiveWorkspace, refetch: refetchWorkspaceContext } = useWorkspace();
  const { toast } = useToast();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showLogoLink, setShowLogoLink] = useState(false);

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
    setShowLogoLink(false);
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
          logoUrl: logoUrl.trim() || null,
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

  async function handleLogoFile(file?: File) {
    if (!tenant || !file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Choose an image', description: 'Use a PNG, JPG, SVG or WebP file.', variant: 'destructive' });
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast({ title: 'Image too large', description: 'Logos can be up to 5 MB.', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      // Keep the file in the media library of the workspace being edited.
      const asset = (await mediaApi.upload(file, tenant.id, undefined, editingId ?? activeWorkspace ?? undefined)) as {
        mediaUrl?: string;
        media_url?: string;
      };
      const url = asset.mediaUrl ?? asset.media_url;
      if (!url) throw new Error('The upload did not return a link.');
      setLogoUrl(url);
      toast({ title: 'Logo uploaded', description: editingId ? 'Save changes to keep it.' : undefined });
    } catch (err: unknown) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Layers className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Workspaces</h1>
            <p className="text-muted-foreground text-sm mt-0.5 max-w-lg">
              Separate brands, clients, or business units. Brand voice, content, and publisher
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
                  Create your first workspace to organize Brand voice, content, and social accounts
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
                      <WorkspaceLogo
                        name={ws.name}
                        logoUrl={ws.logoUrl}
                        className="h-12 w-12 rounded-xl text-sm"
                        fallbackClassName={isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                      />

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
                          Brand voice · Content · Connections · Chatbot
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
                        : 'Each workspace gets its own Brand voice and content.'}
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
                    <Label>Logo</Label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          void handleLogoFile(e.dataTransfer.files?.[0]);
                        }}
                        disabled={uploadingLogo}
                        className="group relative rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={logoUrl.trim() ? 'Replace logo' : 'Upload logo'}
                      >
                        {logoUrl.trim() ? (
                          <WorkspaceLogo name={name || 'Workspace'} logoUrl={logoUrl} className="h-16 w-16 rounded-xl text-base" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                            <ImagePlus className="h-5 w-5" />
                          </div>
                        )}
                        {uploadingLogo && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        )}
                      </button>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? 'Uploading…' : logoUrl.trim() ? 'Replace' : 'Upload image'}
                          </Button>
                          {logoUrl.trim() && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-muted-foreground"
                              onClick={() => setLogoUrl('')}
                              disabled={uploadingLogo}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">PNG, JPG, SVG or WebP, up to 5 MB. A square image works best.</p>
                      </div>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => void handleLogoFile(e.target.files?.[0])}
                    />
                    {showLogoLink ? (
                      <Input
                        id="ws-logo"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://…"
                        className="h-8 text-xs"
                        aria-label="Logo link"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        onClick={() => setShowLogoLink(true)}
                      >
                        Or paste a link to an image
                      </button>
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
              This removes the workspace and its scoped Brand voice profile. Content and connected
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
