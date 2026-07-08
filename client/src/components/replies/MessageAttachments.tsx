import { cn } from '@/lib/utils';

type Attachment = { url?: string; type?: string; name?: string; mimeType?: string };

export function MessageAttachments({
  items,
  className,
}: {
  items: Attachment[];
  className?: string;
}) {
  if (!items?.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((a, i) => {
        const isVideo = a.type === 'video' || a.mimeType?.startsWith('video');
        if (a.url) {
          return isVideo ? (
            <video
              key={`${a.url}-${i}`}
              src={a.url}
              controls
              playsInline
              className="max-h-48 max-w-full rounded-xl border border-border/60 shadow-sm"
            />
          ) : (
            <a
              key={`${a.url}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-border/60 shadow-sm hover:ring-2 hover:ring-primary/20 transition-all"
            >
              <img
                src={a.url}
                alt={a.name ?? 'attachment'}
                className="max-h-48 max-w-full object-cover"
              />
            </a>
          );
        }
        return (
          <span
            key={i}
            className="text-xs bg-muted px-2 py-1 rounded-md"
          >
            {a.name ?? a.type ?? 'Attachment'}
          </span>
        );
      })}
    </div>
  );
}
