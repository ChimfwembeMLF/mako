import { formatDistanceToNow } from 'date-fns';
import { Globe, MessageCircle, Share2, ThumbsUp } from 'lucide-react';
import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { FacebookImageGrid, MediaCarousel, PreviewAvatar } from './shared';
import { EngagementStats } from './EngagementStats';
import type { SocialPreviewProps } from './types';

export function FacebookPreview({
  payload,
  mode = 'draft',
  authorName = 'Your Page',
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
      <div className="px-3 py-2.5 flex items-start gap-2">
        <PreviewAvatar name={authorName} color="#1877f2" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">{authorName}</p>
          <p className="text-xs text-[#65676b] flex items-center gap-1">
            {publishedAt
              ? formatDistanceToNow(new Date(publishedAt), { addSuffix: true })
              : 'Just now'}
            · <Globe className="h-3 w-3" />
          </p>
        </div>
      </div>

      {(plain || mode === 'draft') && (
        <div className="px-3 pb-2 text-[15px] leading-snug">
          {mode === 'published' ? (
            <p className="whitespace-pre-wrap">{plain}</p>
          ) : (
            <RichTextContent html={payload.content ?? ''} emptyPlaceholder="What's on your mind?" />
          )}
        </div>
      )}

      {images.length > 1 || videos.length > 0 ? (
        images.length > 1 ? (
          <MediaCarousel items={images} aspectClass="aspect-[1.91/1]" dotStyle="facebook" />
        ) : (
          <FacebookImageGrid images={images} videos={videos} />
        )
      ) : images.length === 1 ? (
        <FacebookImageGrid images={images} videos={[]} />
      ) : null}

      {mode === 'published' && <EngagementStats engagement={engagement} />}

      <div className="mx-3 mt-2 pt-2 border-t flex items-center justify-around text-[#65676b] text-sm font-medium py-1">
        <span className="inline-flex items-center gap-1.5 py-1"><ThumbsUp className="h-4 w-4" /> Like</span>
        <span className="inline-flex items-center gap-1.5 py-1"><MessageCircle className="h-4 w-4" /> Comment</span>
        <span className="inline-flex items-center gap-1.5 py-1"><Share2 className="h-4 w-4" /> Share</span>
      </div>
    </div>
  );
}
