import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { mediaApi } from '@/lib/api';
import {
  formatFileSize,
  normalizeMediaAsset,
  resolveMediaUrl,
  type MediaAsset,
} from '@/lib/mediaUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { Image, Upload, Search, Trash2, Loader2 } from 'lucide-react';

export default function MediaLibraryPage() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const rows = await mediaApi.findAll(tenant.id, activeWorkspace);
      setAssets(
        (Array.isArray(rows) ? rows : []).map((r) =>
          normalizeMediaAsset(r as Record<string, unknown>),
        ),
      );
    } catch {
      setAssets([]);
    }
    setLoading(false);
  }, [tenant, activeWorkspace]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets, workspaceVersion]);

  const filtered = assets.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (a.name ?? '').toLowerCase().includes(q) || a.mediaType.toLowerCase().includes(q);
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !tenant || !activeWorkspace) return;
    setUploading(true);
    try {
      for (const file of files) {
        await mediaApi.upload(file, tenant.id, undefined, activeWorkspace);
      }
      toast({ title: 'Upload complete', description: `${files.length} file(s) added.` });
      await loadAssets();
    } catch (err: unknown) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deleteAsset(asset: MediaAsset) {
    if (!tenant || !activeWorkspace) return;
    if (!window.confirm(`Delete "${asset.name ?? 'this asset'}"?`)) return;
    setDeletingId(asset.id);
    try {
      await mediaApi.remove(asset.id, tenant.id, activeWorkspace);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast({ title: 'Asset deleted' });
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <PermissionGate require={P.media.view} fallback={true}>
      <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Image className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Media</h1>
              <p className="text-sm text-muted-foreground">
                All brand assets for {tenant?.name} — stored in cloud storage.
              </p>
            </div>
          </div>
          <PermissionGate require={P.media.upload}>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                multiple
                onChange={handleUpload}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Uploading…' : 'Upload Asset'}
              </Button>
            </div>
          </PermissionGate>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Image className="h-14 w-14 opacity-20 mb-4" />
            <p className="text-sm">
              {search ? 'No assets match your search.' : 'No assets yet. Upload one to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((asset) => (
              <div key={asset.id} className="group relative rounded-lg border bg-card overflow-hidden">
                <div className="aspect-square bg-muted">
                  {asset.mediaType === 'video' ? (
                    <video
                      src={resolveMediaUrl(asset.mediaUrl)}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={resolveMediaUrl(asset.mediaUrl)}
                      alt={asset.name ?? ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium truncate">{asset.name ?? 'Untitled'}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {asset.mediaType}
                    {asset.fileSizeBytes ? ` · ${formatFileSize(asset.fileSizeBytes)}` : ''}
                  </p>
                </div>
                <PermissionGate require={P.media.delete}>
                  <button
                    type="button"
                    onClick={() => deleteAsset(asset)}
                    disabled={deletingId === asset.id}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-background/90 border opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                    title="Delete"
                  >
                    {deletingId === asset.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </PermissionGate>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
