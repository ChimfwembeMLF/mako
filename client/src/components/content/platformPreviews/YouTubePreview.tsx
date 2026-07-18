import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { YouTubeThumbnail } from './shared';
import type { SocialPreviewProps } from './types';

export function YouTubePreview({
  payload,
  mode = 'draft',
  authorName = 'Your Channel',
  className,
}: SocialPreviewProps) {
  const videos = (payload.media ?? []).filter((m) => m.type === 'video');
  const plain = htmlToPlainText(payload.content ?? '');

  return (
    <div className={cn('space-y-3 max-w-md', className)}>
      <YouTubeThumbnail
        video={videos[0]}
        title={payload.title || plain.split('\n')[0]?.slice(0, 100)}
        authorName={authorName}
      />
      {plain && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Description
          </p>
          {mode === 'published' ? (
            <p className="whitespace-pre-wrap text-muted-foreground">{plain}</p>
          ) : (
            <RichTextContent html={payload.content ?? ''} className="text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
