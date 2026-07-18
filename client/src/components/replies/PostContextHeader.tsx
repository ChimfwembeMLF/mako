import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PostInboxGroup } from '@/lib/api';
import { platformOf } from '@/lib/platforms';
import { Badge } from '@/components/ui/badge';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { plainText } from './postInboxUtils';
import { cn } from '@/lib/utils';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Compact post context for comment/DM inboxes — not a social feed mockup. */
export function PostContextHeader({
  post,
  hideViewLink = false,
  className,
}: {
  post: PostInboxGroup;
  hideViewLink?: boolean;
  className?: string;
}) {
  const plat = platformOf(post.platform);
  const Icon = plat.icon;
  const excerpt = plainText(post.postContent).slice(0, 320);
  const media = (post.postMedia ?? []).filter((m) => m.url).slice(0, 4);

  const metrics = [
    { label: 'Likes', value: post.likeCount },
    { label: 'Comments', value: post.commentCount || post.totalComments },
    { label: 'Shares', value: post.shareCount },
    { label: 'Views', value: post.viewCount },
  ].filter((m) => (m.value ?? 0) > 0);

  return (
    <div className={cn('rounded-lg border bg-muted/30 overflow-hidden', className)}>
      <div className="px-4 py-3 border-b bg-background/80 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${plat.color}18` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: plat.color }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Published on {plat.label}
            </span>
            {post.pendingCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {post.pendingCount} pending
              </Badge>
            )}
          </div>
          <h3 className="text-sm font-semibold leading-snug">
            {post.postTitle?.trim() || 'Untitled post'}
          </h3>
          {post.brandPageName && (
            <p className="text-xs text-muted-foreground">as {post.brandPageName}</p>
          )}
          {post.publishedAt && (
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })}
            </p>
          )}
        </div>
        {!hideViewLink && (
          <Link
            to={`/content/${post.contentId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            Open post <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {media.length > 0 && (
        <div className="flex gap-2 p-3 overflow-x-auto border-b bg-background/50">
          {media.map((item, i) => (
            <div
              key={`${item.url}-${i}`}
              className="h-16 w-16 rounded-md overflow-hidden border shrink-0 bg-muted"
            >
              {item.type?.startsWith('video') ? (
                <video src={resolveMediaUrl(item.url)} className="h-full w-full object-cover" muted />
              ) : (
                <img src={resolveMediaUrl(item.url)} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      {excerpt && (
        <p className="px-4 py-3 text-sm text-muted-foreground leading-relaxed border-b whitespace-pre-wrap">
          {excerpt}
          {plainText(post.postContent).length > excerpt.length ? '…' : ''}
        </p>
      )}

      {metrics.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {metrics.map((m) => (
            <span key={m.label}>
              <span className="font-semibold text-foreground">{fmt(m.value!)}</span> {m.label.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
