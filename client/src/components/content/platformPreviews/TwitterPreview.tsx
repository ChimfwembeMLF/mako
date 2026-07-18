import { formatDistanceToNow } from 'date-fns';
import { BarChart2, Heart, MessageCircle, Repeat2, Share } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { PreviewAvatar, TwitterImageGrid } from './shared';
import type { SocialPreviewProps } from './types';

export function TwitterPreview({
  payload,
  mode = 'draft',
  authorName = 'Your Brand',
  publishedAt,
  className,
}: SocialPreviewProps) {
  const media = payload.media ?? [];
  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');
  const plain = htmlToPlainText(payload.content ?? '');
  const handle = authorName.replace(/\s+/g, '').toLowerCase();

  return (
    <div className={cn('rounded-xl border bg-white shadow-sm overflow-hidden max-w-md', className)}>
      <div className="px-3 py-3 flex gap-2">
        <PreviewAvatar name={authorName} color="#000" size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight">
            <span className="font-bold">{authorName}</span>{' '}
            <span className="text-muted-foreground">@{handle}</span>{' '}
            <span className="text-muted-foreground">· {publishedAt ? formatDistanceToNow(new Date(publishedAt)) : 'now'}</span>
          </p>
          <div className="text-[15px] mt-1 leading-normal">
            {mode === 'published' ? (
              <p className="whitespace-pre-wrap">{plain}</p>
            ) : (
              <RichTextContent html={payload.content ?? ''} emptyPlaceholder="What's happening?" />
            )}
          </div>

          {videos.length > 0 && (
            <div className="mt-2 rounded-2xl overflow-hidden border">
              {videos[0]?.url ? (
                <video
                  src={resolveMediaUrl(videos[0].url)}
                  className="w-full max-h-80 object-cover"
                  controls
                  playsInline
                />
              ) : (
                <div className="aspect-video bg-black flex items-center justify-center text-white/60 text-xs">
                  Video
                </div>
              )}
            </div>
          )}

          {images.length > 0 && <div className="mt-2 -mx-1"><TwitterImageGrid images={images} /></div>}

          <div className="mt-3 flex items-center justify-between max-w-[85%] text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <Repeat2 className="h-4 w-4" />
            <Heart className="h-4 w-4" />
            <BarChart2 className="h-4 w-4" />
            <Share className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
