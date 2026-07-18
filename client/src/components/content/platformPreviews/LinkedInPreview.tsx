import { formatDistanceToNow } from 'date-fns';
import { Globe, MessageCircle, Repeat2, Send, ThumbsUp } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { MediaCarousel, PreviewAvatar } from './shared';
import { EngagementStats } from './EngagementStats';
import type { SocialPreviewProps } from './types';

export function LinkedInPreview({
  payload,
  mode = 'draft',
  authorName = 'Your Company',
  publishedAt,
  engagement,
  className,
}: SocialPreviewProps) {
  const media = payload.media ?? [];
  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');
  const plain = htmlToPlainText(payload.content ?? '');

  return (
    <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden max-w-md', className)}>
      <div className="px-3 py-3 flex items-start gap-2">
        <PreviewAvatar name={authorName} color="#0a66c2" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{authorName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {publishedAt
              ? formatDistanceToNow(new Date(publishedAt), { addSuffix: true })
              : 'Just now'}
            · <Globe className="h-3 w-3" />
          </p>
        </div>
      </div>

      <div className="px-3 pb-2 text-sm leading-relaxed">
        {payload.title && (
          <p className="font-semibold mb-1">{payload.title}</p>
        )}
        {mode === 'published' ? (
          <p className="whitespace-pre-wrap">{plain}</p>
        ) : (
          <RichTextContent html={payload.content ?? ''} emptyPlaceholder="Share an update…" />
        )}
      </div>

      {videos.length > 0 ? (
        <MediaCarousel items={videos} aspectClass="aspect-[1.91/1]" dotStyle="linkedin" rounded />
      ) : images.length > 1 ? (
        <MediaCarousel items={images} aspectClass="aspect-[1.91/1]" dotStyle="linkedin" rounded />
      ) : images.length === 1 ? (
        <img
          src={resolveMediaUrl(images[0]!.url)}
          alt=""
          className="mx-3 mb-2 rounded-lg w-[calc(100%-1.5rem)] aspect-[1.91/1] object-cover"
        />
      ) : null}

      {mode === 'published' && <EngagementStats engagement={engagement} />}

      <div className="mx-3 py-2 border-t flex items-center justify-around text-xs text-muted-foreground font-medium">
        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> Like</span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4" /> Comment</span>
        <span className="inline-flex items-center gap-1"><Repeat2 className="h-4 w-4" /> Repost</span>
        <span className="inline-flex items-center gap-1"><Send className="h-4 w-4" /> Send</span>
      </div>
    </div>
  );
}
