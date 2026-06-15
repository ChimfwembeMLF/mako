import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Share2, ThumbsUp } from 'lucide-react';
import {
  platformOf,
  PlatformPayload,
  validatePlatformPayload,
} from '@/lib/platforms';
import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import {
  platformMediaFirst,
  renderPlatformPostMedia,
} from './platformPostMedia';

export type PlatformPreviewEngagement = {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
};

interface PlatformPreviewProps {
  platform: string;
  payload: PlatformPayload;
  className?: string;
  mode?: 'draft' | 'published';
  authorName?: string;
  publishedAt?: string | null;
  engagement?: PlatformPreviewEngagement;
}

export function PlatformPreview({
  platform,
  payload,
  className,
  mode = 'draft',
  authorName,
  publishedAt,
  engagement,
}: PlatformPreviewProps) {
  const def = platformOf(platform);
  const Icon = def.icon;
  const richHtml = payload.content ?? '';
  const plainCaption = htmlToPlainText(richHtml);
  const validation = validatePlatformPayload(platform, payload);
  const media = payload.media ?? [];
  const isPublished = mode === 'published';
  const displayName = authorName ?? 'Tekrem Innvation Solutions';

  const charFooter = !isPublished && (
    <div
      className={cn(
        'px-4 pb-3 text-[10px]',
        validation.overCharLimit ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {validation.charCount.toLocaleString()} / {def.maxChars.toLocaleString()} characters
      {validation.attachmentCount > 0 &&
        ` · ${validation.attachmentCount}/${def.media.maxAttachments} attachments`}
    </div>
  );

  const engagementBar = isPublished && engagement && (
    <div className="px-4 py-2.5 border-t flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      {(engagement.likes ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white">
            <ThumbsUp className="h-2.5 w-2.5" />
          </span>
          {engagement.likes!.toLocaleString()}
        </span>
      )}
      {(engagement.comments ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" />
          {engagement.comments!.toLocaleString()}
        </span>
      )}
      {(engagement.shares ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1">
          <Share2 className="h-3.5 w-3.5" />
          {engagement.shares!.toLocaleString()}
        </span>
      )}
      {(engagement.views ?? 0) > 0 && (
        <span>{engagement.views!.toLocaleString()} views</span>
      )}
    </div>
  );

  const header = (
    <div className="px-4 py-3 flex items-center gap-2.5 border-b bg-muted/20">
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 ring-2 ring-background"
        style={{ backgroundColor: `${def.color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color: def.color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{displayName}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {def.label}
          {publishedAt
            ? ` · ${formatDistanceToNow(new Date(publishedAt), { addSuffix: true })}`
            : isPublished
              ? ''
              : ` · ${def.media.aspectRatio}`}
        </p>
      </div>
    </div>
  );

  const titleBlock =
    payload.title && platform === 'linkedin' ? (
      <p className="text-sm font-semibold leading-snug mb-1.5">{payload.title}</p>
    ) : null;

  const contentBlock = (
    <div className="px-4 py-3">
      {titleBlock}
      {isPublished ? (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {plainCaption || ''}
        </p>
      ) : (
        <RichTextContent
          html={richHtml}
          emptyPlaceholder="Your post content will appear here…"
        />
      )}
      {!isPublished && richHtml && plainCaption !== richHtml.replace(/<[^>]*>/g, '').trim() && (
        <p className="text-[10px] text-muted-foreground mt-2 border-t pt-2">
          Live on {def.label}: formatting becomes plain text; links stay as URLs.
        </p>
      )}
    </div>
  );

  const mediaBlock = renderPlatformPostMedia(platform, media, { mode });

  if (def.previewType === 'email') {
    const images = media.filter((m) => m.type === 'image');
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Email preview</span>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="font-semibold">{payload.title || 'Subject line'}</p>
          {images.length > 0 && mediaBlock}
          <RichTextContent html={richHtml} className="text-muted-foreground" />
        </div>
        {charFooter}
      </div>
    );
  }

  if (def.previewType === 'ad') {
    const images = media.filter((m) => m.type === 'image');
    const videos = media.filter((m) => m.type === 'video');
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-2 border-b bg-amber-500/10 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Ad preview · {def.media.recommendedImageSize}</span>
        </div>
        <div className="p-4">
          {(images[0] || videos[0]) && mediaBlock}
          <p className="font-semibold text-sm">{payload.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            <RichTextContent html={richHtml} />
          </p>
          <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground">
            Learn more
          </span>
        </div>
        {charFooter}
      </div>
    );
  }

  const mediaFirst = platformMediaFirst(platform);

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden w-full shadow-sm', className)}>
      {header}
      {mediaFirst ? (
        <>
          {mediaBlock}
          {contentBlock}
        </>
      ) : (
        <>
          {contentBlock}
          {mediaBlock}
        </>
      )}

      {!isPublished && validation.errors.length > 0 && (
        <div className="px-4 pb-2 space-y-0.5">
          {validation.errors.slice(0, 2).map((e) => (
            <p key={e} className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {e}
            </p>
          ))}
        </div>
      )}

      {engagementBar}
      {charFooter}
    </div>
  );
}
