import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react';
import { PlatformPayload } from '@/lib/platforms';
import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { MediaCarousel, PreviewAvatar } from './shared';
import { EngagementStats } from './EngagementStats';
import type { SocialPreviewProps } from './types';

export function InstagramPreview({
  payload,
  mode = 'draft',
  authorName = 'yourbrand',
  engagement,
  className,
}: SocialPreviewProps) {
  const media = payload.media ?? [];
  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');
  const carouselItems = videos.length ? videos : images;
  const plain = htmlToPlainText(payload.content ?? '');
  const handle = authorName.replace(/\s+/g, '').toLowerCase();

  return (
    <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden max-w-sm', className)}>
      <div className="px-3 py-2 flex items-center gap-2 border-b">
        <PreviewAvatar name={authorName} color="#e1306c" size="sm" />
        <p className="text-sm font-semibold flex-1 truncate">{handle}</p>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </div>

      {carouselItems.length > 0 ? (
        <MediaCarousel
          items={carouselItems}
          aspectClass="aspect-square"
          dotStyle="instagram"
        />
      ) : (
        <div className="aspect-square bg-gradient-to-br from-purple-100 via-pink-50 to-orange-50 flex items-center justify-center text-xs text-muted-foreground">
          Add photo or video
        </div>
      )}

      <div className="px-3 py-2 flex items-center gap-4">
        <Heart className="h-6 w-6" />
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <Bookmark className="h-6 w-6 ml-auto" />
      </div>

      <div className="px-3 pb-3 text-sm">
        {mode === 'published' && (
          <EngagementStats engagement={engagement} variant="inline" className="mb-2 font-semibold text-foreground" />
        )}
        <p>
          <span className="font-semibold mr-1">{handle}</span>
          {mode === 'published' ? (
            <span className="whitespace-pre-wrap">{plain}</span>
          ) : (
            <RichTextContent
              html={payload.content ?? ''}
              emptyPlaceholder="Write a caption…"
              className="inline"
            />
          )}
        </p>
      </div>
    </div>
  );
}
