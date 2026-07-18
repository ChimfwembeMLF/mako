import { platformOf, PlatformPayload, validatePlatformPayload } from '@/lib/platforms';
import { RichTextContent } from '@/components/RichTextContent';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { PlatformSocialPreview } from './platformPreviews';
import type { PlatformPreviewEngagement } from './platformPreviews/types';

export type { PlatformPreviewEngagement };

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
  const validation = validatePlatformPayload(platform, payload);
  const isPublished = mode === 'published';

  if (def.previewType === 'social' && platform !== 'ad_copy') {
    return (
      <PlatformSocialPreview
        platform={platform}
        payload={payload}
        mode={mode}
        authorName={authorName}
        publishedAt={publishedAt}
        engagement={engagement}
        className={className}
      />
    );
  }

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

  if (def.previewType === 'email') {
    const images = (payload.media ?? []).filter((m) => m.type === 'image');
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Email preview</span>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="font-semibold">{payload.title || 'Subject line'}</p>
          {images.length > 0 && (
            <img src={images[0]!.url} alt="" className="w-full max-h-48 object-cover rounded" />
          )}
          <RichTextContent html={payload.content ?? ''} className="text-muted-foreground" />
        </div>
        {charFooter}
      </div>
    );
  }

  if (def.previewType === 'ad') {
    const images = (payload.media ?? []).filter((m) => m.type === 'image');
    const videos = (payload.media ?? []).filter((m) => m.type === 'video');
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-2 border-b bg-amber-500/10 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Ad preview · {def.media.recommendedImageSize}</span>
        </div>
        <div className="p-4">
          {(images[0] || videos[0]) && images[0] && (
            <img src={images[0].url} alt="" className="w-full rounded-lg mb-3 aspect-[1.91/1] object-cover" />
          )}
          <p className="font-semibold text-sm">{payload.title}</p>
          <RichTextContent html={payload.content ?? ''} className="text-sm text-muted-foreground mt-1" />
          <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground">
            Learn more
          </span>
        </div>
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
        {charFooter}
      </div>
    );
  }

  return null;
}
