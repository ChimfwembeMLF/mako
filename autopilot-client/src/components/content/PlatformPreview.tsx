import {
  platformOf,
  PlatformPayload,
  stripHtml,
  validatePlatformPayload,
} from '@/lib/platforms';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface PlatformPreviewProps {
  platform: string;
  payload: PlatformPayload;
  className?: string;
}

export function PlatformPreview({ platform, payload, className }: PlatformPreviewProps) {
  const def = platformOf(platform);
  const Icon = def.icon;
  const text = stripHtml(payload.content);
  const media = payload.media ?? [];
  const validation = validatePlatformPayload(platform, payload);
  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');

  const charFooter = (
    <div
      className={cn(
        'px-4 pb-3 text-[10px]',
        validation.overCharLimit ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {validation.charCount.toLocaleString()} / {def.maxChars.toLocaleString()} characters
      {validation.attachmentCount > 0 &&
        ` · ${validation.attachmentCount}/${def.media.maxAttachments} attachments`}
    </div>
  );

  if (def.previewType === 'email') {
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Email preview</span>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="font-semibold">{payload.title || 'Subject line'}</p>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((m, i) => (
                <img
                  key={i}
                  src={resolveMediaUrl(m.url)}
                  alt=""
                  className="max-h-32 rounded border object-cover"
                />
              ))}
            </div>
          )}
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
        {charFooter}
      </div>
    );
  }

  if (def.previewType === 'ad') {
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-2 border-b bg-amber-500/10 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Ad preview · {def.media.recommendedImageSize}</span>
        </div>
        <div className="p-4">
          {(images[0] || videos[0]) && (
            images[0] ? (
              <img
                src={resolveMediaUrl(images[0].url)}
                alt=""
                className="w-full aspect-[1.91/1] object-cover rounded-lg mb-3 border"
              />
            ) : (
              <div className="w-full aspect-[1.91/1] rounded-lg mb-3 border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                Video creative
              </div>
            )
          )}
          <p className="font-semibold text-sm">{payload.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{text}</p>
          <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground">
            Learn more
          </span>
        </div>
        {charFooter}
      </div>
    );
  }

  // Social — platform-specific media layout
  const renderMedia = () => {
    if (videos.length > 0 && platform === 'tiktok') {
      return (
        <div className="aspect-[9/16] max-h-72 bg-black flex items-center justify-center border-y">
          <span className="text-xs text-white/70">9:16 video preview</span>
        </div>
      );
    }

    if (videos.length === 1 && images.length === 0) {
      return (
        <div className="aspect-video max-h-48 bg-muted flex items-center justify-center border-y text-xs text-muted-foreground">
          Video · max {def.media.maxVideoDurationSec}s
        </div>
      );
    }

    if (images.length === 0) return null;

    if (platform === 'instagram' && images.length > 1) {
      return (
        <div className="grid grid-cols-2 gap-0.5 border-y">
          {images.slice(0, 4).map((m, i) => (
            <img
              key={i}
              src={resolveMediaUrl(m.url)}
              alt=""
              className={cn(
                'w-full object-cover',
                images.length === 1 ? 'aspect-square max-h-56' : 'aspect-square h-28',
                i === 0 && images.length === 3 ? 'row-span-2 h-full' : '',
              )}
            />
          ))}
        </div>
      );
    }

    if (platform === 'twitter' && images.length > 1) {
      return (
        <div
          className={cn(
            'grid gap-0.5 border-y',
            images.length === 2 ? 'grid-cols-2' : 'grid-cols-2',
          )}
        >
          {images.slice(0, 4).map((m, i) => (
            <img
              key={i}
              src={resolveMediaUrl(m.url)}
              alt=""
              className={cn(
                'w-full object-cover',
                images.length === 1 ? 'max-h-48' : 'h-24',
                images.length === 3 && i === 0 ? 'row-span-2 h-full' : '',
              )}
            />
          ))}
        </div>
      );
    }

    return (
      <img
        src={resolveMediaUrl(images[0].url)}
        alt=""
        className={cn(
          'w-full object-cover border-y',
          platform === 'linkedin' ? 'max-h-52 aspect-[1.91/1]' : 'max-h-48',
        )}
      />
    );
  };

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden w-full', className)}>
      <div className="px-4 py-3 flex items-center gap-2 border-b">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Tekrem Innvation Solutions</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {def.label} · {def.media.aspectRatio}
          </p>
        </div>
      </div>

      {renderMedia()}

      <div className="p-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {text || 'Your post content will appear here…'}
        </p>
      </div>

      {validation.errors.length > 0 && (
        <div className="px-4 pb-2 space-y-0.5">
          {validation.errors.slice(0, 2).map((e) => (
            <p key={e} className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {e}
            </p>
          ))}
        </div>
      )}

      {charFooter}
    </div>
  );
}
