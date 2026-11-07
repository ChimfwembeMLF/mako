import { confirmModal } from '@/components/ConfirmModal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Copy, Download, HelpCircle, ImageIcon, Loader2, Play, Search, Trash2, Upload, X } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { mediaApi } from '@/lib/api';
import { formatFileSize, normalizeMediaAsset, resolveMediaUrl, type MediaAsset } from '@/lib/mediaUrl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { DataPagination } from '@/components/DataPagination';
import { TourService } from '@/services/tour.service';
import { mediaLibraryTourConfig } from './MediaLibrary.tour';
import { cn } from '@/lib/utils';

type TypeFilter = 'all' | 'image' | 'video';
type Sort = 'newest' | 'oldest' | 'largest' | 'name';

const MAX_UPLOAD_MB = 50;

export default function MediaLibraryPage() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [loading, setLoading] = useState(true);
  const [upload, setUpload] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const canUpload = can(P.media.upload);
  const canDelete = can(P.media.delete);

  const loadAssets = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const rows = await mediaApi.findAll(tenant.id, activeWorkspace);
      setAssets((Array.isArray(rows) ? rows : []).map((r) => normalizeMediaAsset(r as Record<string, unknown>)));
    } catch (err) {
      setAssets([]);
      toast({ title: 'Could not load media', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant, activeWorkspace, toast]);

  useEffect(() => {
    void loadAssets();
    setSelected(new Set());
  }, [loadAssets, workspaceVersion]);

  const counts = useMemo(
    () => ({
      all: assets.length,
      image: assets.filter((a) => a.mediaType !== 'video').length,
      video: assets.filter((a) => a.mediaType === 'video').length,
    }),
    [assets],
  );
  const totalBytes = useMemo(() => assets.reduce((n, a) => n + (a.fileSizeBytes ?? 0), 0), [assets]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = assets.filter((a) => {
      if (type === 'video' && a.mediaType !== 'video') return false;
      if (type === 'image' && a.mediaType === 'video') return false;
      return !q || (a.name ?? '').toLowerCase().includes(q);
    });
    const time = (a: MediaAsset) => (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    return [...list].sort((a, b) =>
      sort === 'oldest'
        ? time(a) - time(b)
        : sort === 'largest'
          ? (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0)
          : sort === 'name'
            ? (a.name ?? '').localeCompare(b.name ?? '')
            : time(b) - time(a),
    );
  }, [assets, type, search, sort]);

  useEffect(() => setPage(0), [type, search, sort, pageSize]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);
  const pageItems = visible.slice(page * pageSize, (page + 1) * pageSize);

  const previewIndex = visible.findIndex((a) => a.id === previewId);
  const preview = previewIndex >= 0 ? visible[previewIndex] : null;

  async function uploadFiles(files: File[]) {
    if (!tenant || !activeWorkspace || !canUpload) return;
    const accepted = files.filter((f) => /^(image|video)\//.test(f.type));
    const tooBig = accepted.filter((f) => f.size > MAX_UPLOAD_MB * 1024 * 1024);
    const ok = accepted.filter((f) => f.size <= MAX_UPLOAD_MB * 1024 * 1024);
    if (accepted.length < files.length) toast({ title: 'Some files were skipped', description: 'Only images and videos can be uploaded.' });
    if (tooBig.length) toast({ title: `${tooBig.length} file${tooBig.length > 1 ? 's are' : ' is'} over ${MAX_UPLOAD_MB} MB`, variant: 'destructive' });
    if (!ok.length) return;
    let done = 0;
    let failed = 0;
    setUpload({ done, total: ok.length, failed });
    for (const file of ok) {
      try {
        await mediaApi.upload(file, tenant.id, undefined, activeWorkspace);
      } catch {
        failed += 1;
      }
      done += 1;
      setUpload({ done, total: ok.length, failed });
    }
    setUpload(null);
    if (fileRef.current) fileRef.current.value = '';
    toast(
      failed
        ? { title: `${ok.length - failed} of ${ok.length} uploaded`, description: `${failed} failed. Try those again.`, variant: 'destructive' }
        : { title: ok.length === 1 ? 'File uploaded' : `${ok.length} files uploaded` },
    );
    setType('all');
    setSort('newest');
    await loadAssets();
  }

  async function removeAssets(ids: string[]) {
    if (!tenant || !activeWorkspace || !ids.length) return;
    const one = ids.length === 1 ? assets.find((a) => a.id === ids[0]) : null;
    const confirmed = await confirmModal(
      'Posts and templates that already use these files may show a broken image. This can’t be undone.',
      one ? `Delete “${one.name ?? 'this file'}”?` : `Delete ${ids.length} files?`,
      'Delete',
    );
    if (!confirmed) return;
    setDeleting(true);
    let failed = 0;
    for (const id of ids) {
      try {
        await mediaApi.remove(id, tenant.id, activeWorkspace);
        setAssets((prev) => prev.filter((a) => a.id !== id));
      } catch {
        failed += 1;
      }
    }
    setDeleting(false);
    setSelected(new Set());
    setPreviewId(null);
    toast(
      failed
        ? { title: `${ids.length - failed} deleted, ${failed} failed`, variant: 'destructive' }
        : { title: ids.length === 1 ? 'File deleted' : `${ids.length} files deleted` },
    );
  }

  async function copyLink(a: MediaAsset) {
    try {
      await navigator.clipboard.writeText(resolveMediaUrl(a.mediaUrl));
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Could not copy the link', variant: 'destructive' });
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Arrow keys move through the preview.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && previewIndex < visible.length - 1) setPreviewId(visible[previewIndex + 1].id);
      if (e.key === 'ArrowLeft' && previewIndex > 0) setPreviewId(visible[previewIndex - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, previewIndex, visible]);

  const selecting = selected.size > 0;

  return (
    <PermissionGate require={P.media.view} fallback={true}>
      <div
        className="relative w-full min-w-0 space-y-6 pb-10"
        onDragEnter={(e) => {
          if (canUpload && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragOver={(e) => canUpload && e.preventDefault()}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div id="tour-ml-header">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Media</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Images and videos for {tenant?.name ?? 'your brand'}, ready to use in posts, templates and ads.
              {assets.length > 0 && (
                <span className="tabular-nums"> {assets.length.toLocaleString()} files · {formatFileSize(totalBytes)}.</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => TourService.startTour('media_library', mediaLibraryTourConfig.steps, undefined, mediaLibraryTourConfig.driverConfig)}
              aria-label="Show me around"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <PermissionGate require={P.media.upload}>
              <div id="tour-ml-upload">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  multiple
                  onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))}
                />
                <Button onClick={() => fileRef.current?.click()} disabled={!!upload} className="gap-1.5">
                  {upload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {upload ? `Uploading ${Math.min(upload.done + 1, upload.total)} of ${upload.total}…` : 'Upload'}
                </Button>
              </div>
            </PermissionGate>
          </div>
        </div>

        {upload && (
          <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={upload.done} aria-valuemax={upload.total}>
            <div className="h-full bg-primary transition-all" style={{ width: `${(upload.done / upload.total) * 100}%` }} />
          </div>
        )}

        {!loading && assets.length > 0 && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {selecting ? (
              <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
                <button type="button" onClick={() => setSelected(new Set())} className="rounded-md p-1 hover:bg-muted" aria-label="Clear selection">
                  <X className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => setSelected(new Set(pageItems.map((a) => a.id)))}
                >
                  Select page
                </button>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => void removeAssets([...selected])}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-1">
                {([
                  ['all', 'All'],
                  ['image', 'Images'],
                  ['video', 'Videos'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      type === key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {label}
                    <span className={cn('ml-1.5 tabular-nums', type === key ? 'text-background/60' : 'text-muted-foreground/70')}>{counts[key]}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div id="tour-ml-search" className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name"
                  aria-label="Search media"
                  className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort"
                className="h-9 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="largest">Largest</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <button
            type="button"
            onClick={() => canUpload && fileRef.current?.click()}
            disabled={!canUpload}
            className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed bg-card/60 px-6 py-20 text-center transition-colors hover:border-primary/50 disabled:cursor-default"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><ImageIcon className="h-5 w-5 text-muted-foreground" /></span>
            <span className="mt-4 font-display text-lg font-semibold">Add your first files</span>
            <span className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {canUpload ? `Drop images or videos here, or click to choose. Up to ${MAX_UPLOAD_MB} MB each.` : 'Nothing has been uploaded yet.'}
            </span>
          </button>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">No files match.</p>
        ) : (
          <ul id="tour-ml-grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {pageItems.map((a) => {
              const isSel = selected.has(a.id);
              const isVideo = a.mediaType === 'video';
              return (
                <li key={a.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => (selecting ? toggle(a.id) : setPreviewId(a.id))}
                    className={cn(
                      'relative block aspect-square w-full overflow-hidden rounded-xl bg-muted ring-offset-2 ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSel && 'ring-2 ring-primary',
                    )}
                    aria-label={`${selecting ? (isSel ? 'Deselect' : 'Select') : 'Open'} ${a.name ?? 'file'}`}
                  >
                    {isVideo ? (
                      <video src={resolveMediaUrl(a.mediaUrl)} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      <img src={resolveMediaUrl(a.mediaUrl)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    )}
                    {isVideo && (
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                        <Play className="h-2.5 w-2.5 fill-current" /> Video
                      </span>
                    )}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-8 text-left text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="block truncate">{a.name ?? 'Untitled'}</span>
                      <span className="block text-white/70">{a.fileSizeBytes ? formatFileSize(a.fileSizeBytes) : ''}</span>
                    </span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      aria-pressed={isSel}
                      aria-label={isSel ? 'Deselect' : 'Select'}
                      className={cn(
                        'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-opacity',
                        isSel
                          ? 'border-primary bg-primary text-primary-foreground opacity-100'
                          : 'border-white bg-black/30 text-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                        selecting && 'opacity-100',
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
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
            noun={visible.length === 1 ? 'file' : 'files'}
            pageSizes={[24, 48, 96]}
            onPageSizeChange={setPageSize}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {dragging && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void uploadFiles(Array.from(e.dataTransfer.files ?? []));
            }}
          >
            <div className="pointer-events-none flex flex-col items-center rounded-3xl border-2 border-dashed border-primary bg-card px-16 py-14 text-center shadow-xl">
              <Upload className="h-8 w-8 text-primary" />
              <p className="mt-3 font-display text-lg font-semibold">Drop to upload</p>
              <p className="mt-1 text-sm text-muted-foreground">Images and videos up to {MAX_UPLOAD_MB} MB</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          {preview && (
            <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex max-h-[70vh] min-h-[260px] items-center justify-center bg-neutral-950">
                {preview.mediaType === 'video' ? (
                  <video src={resolveMediaUrl(preview.mediaUrl)} controls className="max-h-[70vh] w-full" />
                ) : (
                  <img src={resolveMediaUrl(preview.mediaUrl)} alt={preview.name ?? ''} className="max-h-[70vh] w-auto max-w-full object-contain" />
                )}
              </div>
              <div className="flex flex-col gap-5 p-5">
                <div className="min-w-0 pr-6">
                  <DialogTitle className="break-words text-base font-semibold leading-snug">{preview.name ?? 'Untitled'}</DialogTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {previewIndex + 1} of {visible.length} · use ← → to browse
                  </p>
                </div>
                <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="capitalize">{preview.mediaType}</dd>
                  {preview.fileSizeBytes != null && (<><dt className="text-muted-foreground">Size</dt><dd>{formatFileSize(preview.fileSizeBytes)}</dd></>)}
                  {preview.createdAt && (
                    <>
                      <dt className="text-muted-foreground">Uploaded</dt>
                      <dd title={format(new Date(preview.createdAt), 'PPpp')}>{formatDistanceToNow(new Date(preview.createdAt), { addSuffix: true })}</dd>
                    </>
                  )}
                  {preview.contentId && (<><dt className="text-muted-foreground">Used in</dt><dd>A post</dd></>)}
                </dl>
                <div className="mt-auto grid gap-2">
                  <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void copyLink(preview)}>
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                    <a href={resolveMediaUrl(preview.mediaUrl)} target="_blank" rel="noopener noreferrer" download={preview.name ?? undefined}>
                      <Download className="h-3.5 w-3.5" /> Open original
                    </a>
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void removeAssets([preview.id])}
                      disabled={deleting}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
