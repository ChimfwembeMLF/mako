import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import type { PlatformMediaAttachment } from '@/lib/platforms';
import { cn } from '@/lib/utils';

export function PreviewAvatar({
  name,
  color,
  size = 'md',
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';

  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-semibold shrink-0', dim)}
      style={{ backgroundColor: `${color}22`, color }}
    >
      {initials || '?'}
    </div>
  );
}

export function MediaCarousel({
  items,
  aspectClass = 'aspect-square',
  rounded = false,
  dotStyle = 'instagram',
}: {
  items: PlatformMediaAttachment[];
  aspectClass?: string;
  rounded?: boolean;
  dotStyle?: 'instagram' | 'facebook' | 'linkedin';
}) {
  const [index, setIndex] = useState(0);
  if (!items.length) return null;

  const current = items[index]!;
  const isVideo = current.type === 'video';

  return (
    <div className={cn('relative bg-black/5', rounded && 'rounded-lg overflow-hidden mx-3 mb-2')}>
      <div className={cn('relative w-full overflow-hidden', aspectClass)}>
        {isVideo ? (
          current.url ? (
            <video
              src={resolveMediaUrl(current.url)}
              className="h-full w-full object-cover"
              controls
              playsInline
            />
          ) : (
            <div className="h-full w-full bg-black flex items-center justify-center">
              <Play className="h-10 w-10 text-white/80" />
            </div>
          )
        ) : (
          <img
            src={resolveMediaUrl(current.url)}
            alt=""
            className="h-full w-full object-cover"
          />
        )}

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i === 0 ? items.length - 1 : i - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % items.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {dotStyle === 'instagram' && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                {items.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-colors',
                      i === index ? 'bg-primary scale-110' : 'bg-white/70',
                    )}
                  />
                ))}
              </div>
            )}
            {dotStyle === 'facebook' && (
              <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                {index + 1}/{items.length}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** X/Twitter-style image grid with rounded corners */
export function TwitterImageGrid({ images }: { images: PlatformMediaAttachment[] }) {
  if (!images.length) return null;
  const count = Math.min(images.length, 4);

  const gridClass =
    count === 1
      ? 'grid-cols-1'
      : count === 2
        ? 'grid-cols-2'
        : count === 3
          ? 'grid-cols-2 grid-rows-2'
          : 'grid-cols-2 grid-rows-2';

  return (
    <div className={cn('grid gap-0.5 mx-3 mb-2 overflow-hidden rounded-2xl border', gridClass)}>
      {images.slice(0, 4).map((m, i) => (
        <img
          key={i}
          src={resolveMediaUrl(m.url)}
          alt=""
          className={cn(
            'w-full object-cover',
            count === 1 ? 'max-h-80 aspect-video' : 'h-36 sm:h-40',
            count === 3 && i === 0 && 'row-span-2 h-full min-h-[18rem]',
          )}
        />
      ))}
    </div>
  );
}

/** Facebook masonry-style for 3+ images */
export function FacebookImageGrid({
  images,
  videos,
}: {
  images: PlatformMediaAttachment[];
  videos: PlatformMediaAttachment[];
}) {
  if (videos.length === 1 && images.length === 0) {
    const v = videos[0]!;
    return (
      <div className="mx-0 border-y bg-black">
        {v.url ? (
          <video src={resolveMediaUrl(v.url)} className="w-full max-h-96 object-contain" controls playsInline />
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center text-xs text-muted-foreground">
            Video preview
          </div>
        )}
      </div>
    );
  }

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <img src={resolveMediaUrl(images[0]!.url)} alt="" className="w-full max-h-96 object-cover border-y" />
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 border-y">
        {images.map((m, i) => (
          <img key={i} src={resolveMediaUrl(m.url)} alt="" className="h-48 w-full object-cover" />
        ))}
      </div>
    );
  }

  const extra = images.length - 5;
  return (
    <div className="grid grid-cols-2 gap-0.5 border-y">
      <img src={resolveMediaUrl(images[0]!.url)} alt="" className="row-span-2 h-full min-h-[16rem] object-cover" />
      {images.slice(1, 5).map((m, i) => (
        <div key={i} className="relative">
          <img src={resolveMediaUrl(m.url)} alt="" className="h-32 w-full object-cover" />
          {i === 3 && extra > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-semibold">
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function YouTubeThumbnail({
  video,
  title,
  authorName,
}: {
  video?: PlatformMediaAttachment;
  title?: string;
  authorName: string;
}) {
  return (
    <div className="bg-[#0f0f0f] text-white rounded-xl overflow-hidden">
      <div className="relative aspect-video bg-[#212121]">
        {video?.url ? (
          <>
            <video
              src={resolveMediaUrl(video.url)}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="h-14 w-14 rounded-full bg-[#ff0000] flex items-center justify-center shadow-lg">
                <Play className="h-7 w-7 text-white ml-0.5 fill-white" />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#212121] to-[#0f0f0f] flex items-center justify-center">
            <div className="h-14 w-14 rounded-full bg-[#ff0000]/90 flex items-center justify-center">
              <Play className="h-7 w-7 text-white ml-0.5 fill-white" />
            </div>
          </div>
        )}
        <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
          10:24
        </span>
      </div>
      <div className="p-3 flex gap-3">
        <PreviewAvatar name={authorName} color="#ff0000" size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {title || 'Video title appears here'}
          </p>
          <p className="text-xs text-[#aaaaaa] mt-1">{authorName}</p>
          <p className="text-xs text-[#aaaaaa]">1.2K views · 2 hours ago</p>
        </div>
      </div>
    </div>
  );
}
