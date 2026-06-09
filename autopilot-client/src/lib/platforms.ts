import { Facebook, Instagram, Linkedin, Mail, Megaphone, Twitter, LucideIcon } from 'lucide-react';

export interface PlatformDef {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  maxChars: number;
  previewType: 'social' | 'email' | 'ad';
}

export const PLATFORMS: PlatformDef[] = [
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877f2', maxChars: 63206, previewType: 'social' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: '#e1306c', maxChars: 2200, previewType: 'social' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0a66c2', maxChars: 3000, previewType: 'social' },
  { value: 'twitter', label: 'X / Twitter', icon: Twitter, color: '#1DA1F2', maxChars: 280, previewType: 'social' },
  { value: 'email', label: 'Email', icon: Mail, color: '#10b981', maxChars: 10000, previewType: 'email' },
  { value: 'ad_copy', label: 'Ad Copy', icon: Megaphone, color: '#f59e0b', maxChars: 500, previewType: 'ad' },
  { value: 'tiktok', label: 'TikTok', icon: Instagram, color: '#ff0050', maxChars: 4000, previewType: 'social' },
];

export function platformOf(value: string): PlatformDef {
  return PLATFORMS.find((p) => p.value === value) ?? PLATFORMS[0];
}

export type PlatformPayload = { content: string; title?: string };

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Build per-platform variants from one base body (client-side when AI is unavailable). */
export function buildPlatformPayloads(
  baseContent: string,
  baseTitle: string,
  platforms: string[],
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
    };
  }
  return out;
}
