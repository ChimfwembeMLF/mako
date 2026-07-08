import { platformOf } from '@/lib/platforms';
import type { PlatformMediaAttachment } from '@/lib/platforms';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';

type RenderOptions = {
  /** Show real media (published posts) vs placeholders (draft preview) */
  mode?: 'draft' | 'published';
};

export function renderPlatformPostMedia(
  platform: string,
  media: PlatformMediaAttachment[],
  options: RenderOptions = {},
) {
  const mode = options.mode ?? 'draft';
  const def = platformOf(platform);
  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');

  if (videos.length > 0 && platform === 'tiktok') {
    if (mode === 'published' && videos[0]?.url) {
      return (
        <div className="aspect-[9/16] max-h-[28rem] bg-black border-y">
          <video
            src={resolveMediaUrl(videos[0].url)}
            className="h-full w-full object-contain"
            controls
            playsInline
          />
        </div>
      );
    }
    return (
      <div className="aspect-[9/16] max-h-72 bg-black flex items-center justify-center border-y">
        <span className="text-xs text-white/70">9:16 video preview</span>
      </div>
    );
  }

  if (videos.length === 1 && images.length === 0) {
    if (mode === 'published' && videos[0]?.url) {
      return (
        <div className="border-y bg-black">
          <video
            src={resolveMediaUrl(videos[0].url)}
            className="w-full max-h-[28rem] object-contain"
            controls
            playsInline
          />
        </div>
      );
    }
    return (
      <div className="aspect-video max-h-48 bg-muted flex items-center justify-center border-y text-xs text-muted-foreground">
        Video · max {def.media.maxVideoDurationSec}s
      </div>
    );
  }

  if (images.length === 0) return null;

  const imgClass = (extra?: string) =>
    cn('w-full object-cover', extra);

  if (platform === 'instagram' && images.length > 1) {
    return (
      <div className="grid grid-cols-2 gap-0.5 border-y bg-black/5">
        {images.slice(0, 4).map((m, i) => (
          <img
            key={i}
            src={resolveMediaUrl(m.url)}
            alt=""
            className={imgClass(
              images.length === 1 ? 'aspect-square max-h-56' : 'aspect-square h-32 sm:h-40',
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
          'grid gap-0.5 border-y overflow-hidden rounded-none',
          images.length === 2 ? 'grid-cols-2' : 'grid-cols-2',
        )}
      >
        {images.slice(0, 4).map((m, i) => (
          <img
            key={i}
            src={resolveMediaUrl(m.url)}
            alt=""
            className={imgClass(
              images.length === 1 ? 'max-h-48' : 'h-28 sm:h-32',
              images.length === 3 && i === 0 ? 'row-span-2 h-full' : '',
            )}
          />
        ))}
      </div>
    );
  }

  if (images.length > 1) {
    return (
      <div className="grid grid-cols-2 gap-0.5 border-y">
        {images.map((m, i) => (
          <img
            key={i}
            src={resolveMediaUrl(m.url)}
            alt=""
            className={imgClass('aspect-square h-32 sm:h-40')}
          />
        ))}
      </div>
    );
  }

  return (
    <img
      src={resolveMediaUrl(images[0].url)}
      alt=""
      className={imgClass(
        'border-y',
        platform === 'linkedin' ? 'max-h-64 aspect-[1.91/1]' : 'max-h-80',
      )}
    />
  );
}

/** Instagram & TikTok show media before caption; most others show text first */
export function platformMediaFirst(platform: string): boolean {
  return platform === 'instagram' || platform === 'tiktok';
}
