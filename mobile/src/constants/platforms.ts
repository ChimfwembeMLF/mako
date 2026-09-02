export type PlatformId =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'twitter'
  | 'whatsapp';

export const PLATFORMS: { id: PlatformId; label: string; color: string; bg: string }[] = [
  { id: 'facebook', label: 'Facebook', color: '#1877F2', bg: '#E7F0FF' },
  { id: 'instagram', label: 'Instagram', color: '#E4405F', bg: '#FDE8EC' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', bg: '#E8F1FA' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000', bg: '#FFE8E8' },
  { id: 'tiktok', label: 'TikTok', color: '#0e0f0c', bg: '#E8EBE6' },
  { id: 'twitter', label: 'X / Twitter', color: '#0e0f0c', bg: '#E8EBE6' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', bg: '#E8FAEF' },
];

export function platformMeta(id: string) {
  return PLATFORMS.find((p) => p.id === id) ?? {
    id,
    label: id,
    color: '#454745',
    bg: '#E8EBE6',
  };
}
