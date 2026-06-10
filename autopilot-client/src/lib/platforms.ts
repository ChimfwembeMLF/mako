import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  Megaphone,
  MessageCircle,
  Twitter,
  LucideIcon,
} from 'lucide-react';
import { publishablePlatforms } from '@/lib/platform-capabilities';

export interface PlatformMediaRules {
  maxAttachments: number;
  maxImages: number;
  maxVideos: number;
  maxImageSizeMB: number;
  maxVideoSizeMB: number;
  maxVideoDurationSec: number;
  recommendedImageSize: string;
  aspectRatio: string;
  supportsVideo: boolean;
  supportsCarousel: boolean;
  mediaNotes: string;
}

export interface PlatformDef {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  maxChars: number;
  previewType: 'social' | 'email' | 'ad';
  media: PlatformMediaRules;
}

const ALL_PLATFORM_DEFS: PlatformDef[] = [
  {
    value: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    color: '#1877f2',
    maxChars: 63206,
    previewType: 'social',
    media: {
      maxAttachments: 10,
      maxImages: 10,
      maxVideos: 1,
      maxImageSizeMB: 30,
      maxVideoSizeMB: 4096,
      maxVideoDurationSec: 240 * 60,
      recommendedImageSize: '1200×630 px',
      aspectRatio: '1.91:1 or 1:1',
      supportsVideo: true,
      supportsCarousel: true,
      mediaNotes: 'Up to 10 photos or 1 video per post. Mixing photos + video is not supported.',
    },
  },
  {
    value: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    color: '#e1306c',
    maxChars: 2200,
    previewType: 'social',
    media: {
      maxAttachments: 10,
      maxImages: 10,
      maxVideos: 1,
      maxImageSizeMB: 8,
      maxVideoSizeMB: 4096,
      maxVideoDurationSec: 90,
      recommendedImageSize: '1080×1080 px',
      aspectRatio: '1:1, 4:5, or 9:16',
      supportsVideo: true,
      supportsCarousel: true,
      mediaNotes: 'Carousel: up to 10 images/videos. Reels: 9:16, max 90 sec.',
    },
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    color: '#0a66c2',
    maxChars: 3000,
    previewType: 'social',
    media: {
      maxAttachments: 9,
      maxImages: 9,
      maxVideos: 1,
      maxImageSizeMB: 5,
      maxVideoSizeMB: 5120,
      maxVideoDurationSec: 600,
      recommendedImageSize: '1200×627 px',
      aspectRatio: '1.91:1 or 1:1',
      supportsVideo: true,
      supportsCarousel: true,
      mediaNotes: 'Up to 9 images in a carousel or 1 native video (10 min max).',
    },
  },
  {
    value: 'twitter',
    label: 'X / Twitter',
    icon: Twitter,
    color: '#1DA1F2',
    maxChars: 280,
    previewType: 'social',
    media: {
      maxAttachments: 4,
      maxImages: 4,
      maxVideos: 1,
      maxImageSizeMB: 5,
      maxVideoSizeMB: 512,
      maxVideoDurationSec: 140,
      recommendedImageSize: '1600×900 px',
      aspectRatio: '16:9 or 1:1',
      supportsVideo: true,
      supportsCarousel: false,
      mediaNotes: 'Max 4 images, OR 1 video, OR 1 GIF — not combined.',
    },
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    color: '#25d366',
    maxChars: 4096,
    previewType: 'social',
    media: {
      maxAttachments: 0,
      maxImages: 0,
      maxVideos: 0,
      maxImageSizeMB: 0,
      maxVideoSizeMB: 0,
      maxVideoDurationSec: 0,
      recommendedImageSize: 'N/A',
      aspectRatio: 'N/A',
      supportsVideo: false,
      supportsCarousel: false,
      mediaNotes: 'Text broadcast to opted-in contacts. Media via template messages (coming soon).',
    },
  },
];

/** Platforms available for publishing in Content Engine */
export const PLATFORMS: PlatformDef[] = ALL_PLATFORM_DEFS.filter((p) =>
  publishablePlatforms().some((c) => c.id === p.value),
);

export function platformOf(value: string): PlatformDef {
  return (
    ALL_PLATFORM_DEFS.find((p) => p.value === value) ??
    PLATFORMS.find((p) => p.value === value) ??
    PLATFORMS[0]
  );
}

export type PlatformMediaAttachment = {
  url: string;
  type: 'image' | 'video';
  name?: string;
  fileSizeBytes?: number;
};

export type PlatformPayload = {
  content: string;
  title?: string;
  media?: PlatformMediaAttachment[];
  whatsappTemplate?: string;
  whatsappTemplateLanguage?: string;
  whatsappUseTemplate?: boolean;
};

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function trimMediaForPlatform(
  platform: string,
  media: PlatformMediaAttachment[],
): PlatformMediaAttachment[] {
  const rules = platformOf(platform).media;
  let images = 0;
  let videos = 0;
  const out: PlatformMediaAttachment[] = [];

  for (const item of media) {
    if (item.type === 'video') {
      if (!rules.supportsVideo || videos >= rules.maxVideos) continue;
      videos += 1;
    } else {
      if (images >= rules.maxImages) continue;
      images += 1;
    }
    if (out.length >= rules.maxAttachments) break;
    out.push(item);
  }
  return out;
}

export interface PlatformValidation {
  charCount: number;
  overCharLimit: boolean;
  attachmentCount: number;
  overAttachmentLimit: boolean;
  warnings: string[];
  errors: string[];
}

export function validatePlatformPayload(
  platform: string,
  payload: PlatformPayload,
): PlatformValidation {
  const def = platformOf(platform);
  const rules = def.media;
  const text = stripHtml(payload.content);
  const media = payload.media ?? [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const charCount = text.length;
  const overCharLimit = charCount > def.maxChars;

  if (overCharLimit) {
    errors.push(`Text exceeds ${def.maxChars.toLocaleString()} character limit for ${def.label}.`);
  }

  const imageCount = media.filter((m) => m.type === 'image').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  if (media.length > rules.maxAttachments) {
    errors.push(`Max ${rules.maxAttachments} attachment(s) on ${def.label}.`);
  }
  if (imageCount > rules.maxImages) {
    errors.push(`Max ${rules.maxImages} image(s) on ${def.label}.`);
  }
  if (videoCount > rules.maxVideos) {
    errors.push(`Max ${rules.maxVideos} video(s) on ${def.label}.`);
  }
  if (videoCount > 0 && imageCount > 0 && platform === 'twitter') {
    errors.push('X / Twitter does not allow images and video in the same post.');
  }
  if (videoCount > 0 && !rules.supportsVideo) {
    errors.push(`${def.label} does not support video attachments.`);
  }
  if (imageCount > 0 && rules.maxImages === 0) {
    errors.push(`${def.label} is video-only — remove images.`);
  }

  for (const m of media) {
    if (m.fileSizeBytes) {
      const mb = m.fileSizeBytes / (1024 * 1024);
      if (m.type === 'image' && mb > rules.maxImageSizeMB) {
        warnings.push(
          `"${m.name ?? 'Image'}" is ${mb.toFixed(1)} MB — ${def.label} recommends ≤ ${rules.maxImageSizeMB} MB.`,
        );
      }
      if (m.type === 'video' && rules.maxVideoSizeMB && mb > rules.maxVideoSizeMB) {
        warnings.push(
          `"${m.name ?? 'Video'}" is ${mb.toFixed(1)} MB — ${def.label} max ${rules.maxVideoSizeMB} MB.`,
        );
      }
    }
  }

  if (media.length === 0 && def.previewType === 'social' && platform === 'instagram') {
    warnings.push('Instagram posts perform best with at least one image or video.');
  }

  return {
    charCount,
    overCharLimit,
    attachmentCount: media.length,
    overAttachmentLimit: media.length > rules.maxAttachments,
    warnings,
    errors,
  };
}

export function buildPlatformPayloads(
  baseContent: string,
  baseTitle: string,
  platforms: string[],
  baseMedia: PlatformMediaAttachment[] = [],
): Record<string, PlatformPayload> {
  const plain = stripHtml(baseContent);
  const out: Record<string, PlatformPayload> = {};

  for (const p of platforms) {
    const def = platformOf(p);
    let content = plain;

    if (p === 'twitter' && content.length > def.maxChars) {
      content = content.slice(0, def.maxChars - 3) + '…';
    } else if (p === 'linkedin') {
      content = plain.length > 0 ? plain : baseTitle;
    } else if (p === 'email') {
      content = `Subject: ${baseTitle || 'Your update'}\n\n${plain}`;
    } else if (p === 'ad_copy') {
      content = plain.length > def.maxChars ? plain.slice(0, def.maxChars - 3) + '…' : plain;
    } else if (content.length > def.maxChars) {
      content = content.slice(0, def.maxChars - 3) + '…';
    }

    out[p] = {
      content,
      title: baseTitle || def.label,
      media: trimMediaForPlatform(p, baseMedia),
    };
  }
  return out;
}
