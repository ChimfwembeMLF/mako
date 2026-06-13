import { useState } from 'react';
import { ImagePlus, X, AlertTriangle, Check, ChevronUp, ChevronDown } from 'lucide-react';
import {
  PlatformMediaAttachment,
  platformOf,
  trimMediaForPlatform,
  validatePlatformPayload,
  PlatformPayload,
} from '@/lib/platforms';
import { resolveMediaUrl, type MediaAsset } from '@/lib/mediaUrl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlatformMediaEditorProps {
  platform: string;
  payload: PlatformPayload;
  libraryAssets: MediaAsset[];
  onChange: (media: PlatformMediaAttachment[]) => void;
  onApplyToAll?: () => void;
  onApplyAssetsToAll?: (assets: MediaAsset[]) => void;
  className?: string;
}

export function PlatformMediaEditor({
  platform,
  payload,
  libraryAssets,
  onChange,
  onApplyToAll,
  onApplyAssetsToAll,
  className,
}: PlatformMediaEditorProps) {
  const def = platformOf(platform);
  const rules = def.media;
  const media = payload.media ?? [];
  const validation = validatePlatformPayload(platform, payload);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());

  function addAsset(asset: MediaAsset) {
    if (media.some((m) => m.url === asset.mediaUrl)) return;
    const type = asset.mediaType === 'video' ? 'video' : 'image';
    const next = trimMediaForPlatform(platform, [
      ...media,
      {
        url: asset.mediaUrl,
        type,
        name: asset.name ?? undefined,
        fileSizeBytes: asset.fileSizeBytes ?? undefined,
        assetId: asset.id,
      },
    ]);
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(media.filter((_, i) => i !== index));
  }

  function moveAttachment(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  function toggleLibrarySelect(assetId: string) {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function selectedAssets(): MediaAsset[] {
    return libraryAssets.filter((a) => selectedLibraryIds.has(a.id));
  }

  function addSelectedToPlatform() {
    const assets = selectedAssets();
    if (!assets.length) return;
    let next = [...media];
    for (const asset of assets) {
      if (next.some((m) => m.url === asset.mediaUrl)) continue;
      const type = asset.mediaType === 'video' ? 'video' : 'image';
      next = trimMediaForPlatform(platform, [
        ...next,
        {
          url: asset.mediaUrl,
          type,
          name: asset.name ?? undefined,
          fileSizeBytes: asset.fileSizeBytes ?? undefined,
          assetId: asset.id,
        },
      ]);
    }
    onChange(next);
    setSelectedLibraryIds(new Set());
  }

  function applySelectedToAllPlatforms() {
    const assets = selectedAssets();
    if (!assets.length || !onApplyAssetsToAll) return;
    onApplyAssetsToAll(assets);
    setSelectedLibraryIds(new Set());
  }

  const available = libraryAssets.filter((a) => !media.some((m) => m.url === a.mediaUrl));
  const hasSelection = selectedLibraryIds.size > 0;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attachments
          </span>
          <span className="text-xs text-muted-foreground">
            {media.length} / {rules.maxAttachments}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {onApplyToAll && media.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onApplyToAll}>
              Copy {def.label} attachments to all
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">{def.label} limits:</strong>{' '}
        {rules.mediaNotes} · Images ≤ {rules.maxImageSizeMB} MB
        {rules.supportsVideo ? ` · Video ≤ ${rules.maxVideoSizeMB} MB, ~${rules.maxVideoDurationSec}s` : ''}
        · Recommended {rules.recommendedImageSize} ({rules.aspectRatio})
      </div>

      {media.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Drag order: first attachment publishes first (carousels, galleries).</p>
          <div className="space-y-2">
            {media.map((m, i) => (
              <div
                key={`${m.url}-${i}`}
                className="flex items-center gap-2 rounded-lg border bg-background/80 px-2 py-1.5"
              >
                <span className="text-[10px] font-medium text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <div className="relative shrink-0">
                  {m.type === 'video' ? (
                    <div className="w-14 h-14 rounded-md border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                      Video
                    </div>
                  ) : (
                    <img
                      src={resolveMediaUrl(m.url)}
                      alt=""
                      className="w-14 h-14 rounded-md border object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={i === 0}
                    onClick={() => moveAttachment(i, -1)}
                    aria-label="Move attachment up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={i === media.length - 1}
                    onClick={() => moveAttachment(i, 1)}
                    aria-label="Move attachment down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">
                  {m.name ?? (m.type === 'video' ? 'Video' : 'Image')}
                </p>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="h-7 w-7 shrink-0 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No attachments for {def.label} yet — pick from the library below.</p>
      )}

      {available.length > 0 && media.length < rules.maxAttachments && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Select from library (click to toggle), then add to this platform or all platforms
          </p>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {available.map((a) => {
              const selected = selectedLibraryIds.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleLibrarySelect(a.id)}
                  className={cn(
                    'relative w-12 h-12 rounded-md border overflow-hidden transition-all',
                    selected
                      ? 'ring-2 ring-primary border-primary'
                      : 'hover:ring-2 hover:ring-primary/40',
                  )}
                  aria-pressed={selected}
                >
                  {a.mediaType === 'video' ? (
                    <div className="w-full h-full bg-muted text-[9px] flex items-center justify-center">Vid</div>
                  ) : (
                    <img src={resolveMediaUrl(a.mediaUrl)} alt="" className="w-full h-full object-cover" />
                  )}
                  {selected && (
                    <span className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {hasSelection && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={addSelectedToPlatform}>
                Add {selectedLibraryIds.size} to {def.label}
              </Button>
              {onApplyAssetsToAll && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={applySelectedToAllPlatforms}
                >
                  Apply {selectedLibraryIds.size} to all platforms
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-1">
          {validation.errors.map((e) => (
            <p key={e} className="text-[11px] text-destructive flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              {e}
            </p>
          ))}
          {validation.warnings.map((w) => (
            <p key={w} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
