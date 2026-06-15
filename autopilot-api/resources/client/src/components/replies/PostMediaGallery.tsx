import { cn } from '@/lib/utils';

export type PostMediaItem = { url: string; type?: string; name?: string };

function isVideo(item: PostMediaItem): boolean {
  return Boolean(
    item.type?.startsWith('video') || item.url.match(/\.(mp4|webm|mov|m4v)(\?|$)/i),
  );
}

type Props = {
  items: PostMediaItem[];
  /** compact = small thumbs (inbox list), full = post detail layout */
  variant?: 'compact' | 'full';
  className?: string;
};

export function PostMediaGallery({ items, variant = 'full', className }: Props) {
  if (!items.length) return null;

  if (variant === 'compact') {
    const thumb = items.find((m) => m.url && !isVideo(m)) ?? items[0];
    if (!thumb?.url) return null;
    if (isVideo(thumb)) {
      return (
        <video
          src={thumb.url}
          className={cn('h-20 w-20 rounded-lg object-cover shrink-0 border', className)}
          muted
        />
      );
    }
    return (
      <img
        src={thumb.url}
        alt={thumb.name ?? ''}
        className={cn('h-20 w-20 rounded-lg object-cover shrink-0 border', className)}
      />
    );
  }

  if (items.length === 1) {
    const m = items[0];
    return (
      <div className={cn('mt-3 rounded-xl overflow-hidden border bg-muted/20', className)}>
        {isVideo(m) ? (
          <video src={m.url} className="w-full max-h-[28rem] object-contain bg-black" controls />
        ) : (
          <a href={m.url} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={m.url}
              alt={m.name ?? 'attachment'}
              className="w-full max-h-[28rem] object-contain"
            />
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mt-3 grid gap-2',
        items.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3',
        className,
      )}
    >
      {items.map((m, i) => (
        <a
          key={`${m.url}-${i}`}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border bg-muted/20 hover:ring-2 hover:ring-primary/30 transition-all aspect-square"
        >
          {isVideo(m) ? (
            <video src={m.url} className="h-full w-full object-cover" muted />
          ) : (
            <img src={m.url} alt={m.name ?? `media ${i + 1}`} className="h-full w-full object-cover" />
          )}
        </a>
      ))}
    </div>
  );
}
