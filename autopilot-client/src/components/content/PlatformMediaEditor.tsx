import { ImagePlus, X, AlertTriangle } from 'lucide-react';
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
  className?: string;
}

export function PlatformMediaEditor({
  platform,
  payload,
  libraryAssets,
  onChange,
  onApplyToAll,
  className,
}: PlatformMediaEditorProps) {
  const def = platformOf(platform);
  const rules = def.media;
  const media = payload.media ?? [];
  const validation = validatePlatformPayload(platform, payload);

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

  const available = libraryAssets.filter((a) => !media.some((m) => m.url === a.mediaUrl));

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
        {onApplyToAll && media.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onApplyToAll}>
            Apply to all platforms
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">{def.label} limits:</strong>{' '}
        {rules.mediaNotes} · Images ≤ {rules.maxImageSizeMB} MB
        {rules.supportsVideo ? ` · Video ≤ ${rules.maxVideoSizeMB} MB, ~${rules.maxVideoDurationSec}s` : ''}
        · Recommended {rules.recommendedImageSize} ({rules.aspectRatio})
      </div>

      {media.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {media.map((m, i) => (
            <div key={`${m.url}-${i}`} className="relative group">
              {m.type === 'video' ? (
                <div className="w-16 h-16 rounded-lg border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                  Video
                </div>
              ) : (
                <img
                  src={resolveMediaUrl(m.url)}
                  alt=""
                  className="w-16 h-16 rounded-lg border object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove attachment"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No attachments for {def.label} yet.</p>
      )}

      {available.length > 0 && media.length < rules.maxAttachments && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">Add from library</p>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {available.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => addAsset(a)}
                className="w-12 h-12 rounded-md border overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all"
              >
                {a.mediaType === 'video' ? (
                  <div className="w-full h-full bg-muted text-[9px] flex items-center justify-center">Vid</div>
                ) : (
                  <img src={resolveMediaUrl(a.mediaUrl)} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
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
