import { Bookmark, Heart, MessageCircle, Music2, Share2 } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { PreviewAvatar } from './shared';
import type { SocialPreviewProps } from './types';

export function TikTokPreview({
  payload,
  mode = 'draft',
  authorName = 'yourbrand',
  engagement,
  className,
}: SocialPreviewProps) {
  const videos = (payload.media ?? []).filter((m) => m.type === 'video');
  const plain = htmlToPlainText(payload.content ?? '');
  const handle = `@${authorName.replace(/\s+/g, '').toLowerCase()}`;
  const showSideStats = mode === 'published' && engagement && (
    (engagement.likes ?? 0) > 0 ||
    (engagement.comments ?? 0) > 0 ||
    (engagement.views ?? 0) > 0
  );

  function fmtSide(n?: number) {
    if (!n || n <= 0) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  return (
    <div className={cn('relative rounded-xl overflow-hidden bg-black max-w-[280px] mx-auto shadow-lg', className)}>
      <div className="aspect-[9/16] relative">
        {videos[0]?.url ? (
          <video
            src={resolveMediaUrl(videos[0].url)}
            className="h-full w-full object-cover"
            controls
            playsInline
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-gray-800 to-black flex items-center justify-center text-white/40 text-xs">
            9:16 video
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

        <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 text-white">
          <div className="relative">
            <PreviewAvatar name={authorName} color="#fff" size="sm" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-[#fe2c55] text-[10px] flex items-center justify-center font-bold">+</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Heart className="h-7 w-7" />
            {showSideStats && fmtSide(engagement?.likes) && (
              <span className="text-[10px]">{fmtSide(engagement?.likes)}</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <MessageCircle className="h-7 w-7" />
            {showSideStats && fmtSide(engagement?.comments) && (
              <span className="text-[10px]">{fmtSide(engagement?.comments)}</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Bookmark className="h-7 w-7" />
            <span className="text-[10px]">Save</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Share2 className="h-7 w-7" />
            <span className="text-[10px]">Share</span>
          </div>
        </div>

        <div className="absolute left-3 right-14 bottom-4 text-white">
          <p className="font-semibold text-sm mb-1">{handle}</p>
          <p className="text-sm leading-snug line-clamp-3">
            {plain || (mode === 'draft' ? 'Add a caption with hashtags…' : '')}
          </p>
          <p className="text-xs mt-2 flex items-center gap-1 opacity-90">
            <Music2 className="h-3 w-3" /> original sound — {authorName}
          </p>
        </div>
      </div>
    </div>
  );
}
