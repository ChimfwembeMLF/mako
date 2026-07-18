import type { ComponentType } from 'react';
import { platformOf, validatePlatformPayload } from '@/lib/platforms';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { FacebookPreview } from './FacebookPreview';
import { InstagramPreview } from './InstagramPreview';
import { LinkedInPreview } from './LinkedInPreview';
import { TwitterPreview } from './TwitterPreview';
import { TikTokPreview } from './TikTokPreview';
import { YouTubePreview } from './YouTubePreview';
import { WhatsAppPreview } from './WhatsAppPreview';
import type { PlatformPayload, PlatformPreviewEngagement, SocialPreviewProps } from './types';

export type { PlatformPreviewEngagement, PlatformPayload, SocialPreviewProps };

interface PlatformSocialPreviewProps extends SocialPreviewProps {
  platform: string;
}

const PREVIEW_MAP: Record<string, ComponentType<SocialPreviewProps>> = {
  facebook: FacebookPreview,
  instagram: InstagramPreview,
  linkedin: LinkedInPreview,
  twitter: TwitterPreview,
  tiktok: TikTokPreview,
  youtube: YouTubePreview,
  whatsapp: WhatsAppPreview,
};

export function PlatformSocialPreview({
  platform,
  payload,
  mode = 'draft',
  authorName,
  publishedAt,
  engagement,
  className,
}: PlatformSocialPreviewProps) {
  const def = platformOf(platform);
  const validation = validatePlatformPayload(platform, payload);
  const Preview = PREVIEW_MAP[platform];

  const charFooter = mode === 'draft' && (
    <div
      className={cn(
        'mt-2 text-[10px] text-center',
        validation.overCharLimit ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {validation.charCount.toLocaleString()} / {def.maxChars.toLocaleString()} characters
      {validation.attachmentCount > 0 &&
        ` · ${validation.attachmentCount}/${def.media.maxAttachments} attachments`}
    </div>
  );

  const errors = mode === 'draft' && validation.errors.length > 0 && (
    <div className="mt-2 space-y-0.5">
      {validation.errors.slice(0, 2).map((e) => (
        <p key={e} className="text-[10px] text-destructive flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {e}
        </p>
      ))}
    </div>
  );

  if (!Preview) {
    return null;
  }

  return (
    <div className={cn('w-full', className)}>
      <Preview
        payload={payload}
        mode={mode}
        authorName={authorName}
        publishedAt={publishedAt}
        engagement={engagement}
      />
      {errors}
      {charFooter}
    </div>
  );
}
