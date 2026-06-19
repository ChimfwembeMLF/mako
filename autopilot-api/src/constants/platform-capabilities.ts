export type PlatformCapability = {
  id: string;
  label: string;
  /** Can connect in Publisher Connect */
  connect: boolean;
  /** Can publish / send from Content Engine */
  publish: boolean;
  /** Social post comment fetch + reply */
  comments: boolean;
  /** Direct messaging (WhatsApp DMs) */
  messaging: boolean;
  oauth: boolean;
  status: 'available' | 'coming_soon';
  notes?: string;
};

/** Single source of truth — keep in sync with client `platform-capabilities.ts`. */
export const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    connect: true,
    publish: true,
    comments: true,
    messaging: true,
    oauth: true,
    status: 'available',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    connect: true,
    publish: true,
    comments: true,
    messaging: true,
    oauth: true,
    status: 'available',
    notes: 'Requires Instagram Business linked to a Facebook Page.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    connect: true,
    publish: true,
    comments: false,
    messaging: false,
    oauth: true,
    status: 'available',
    notes:
      'Publishing uses w_member_social. Comment sync/replies require LinkedIn Marketing API partner access (r_member_social), not included in standard OAuth.',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    connect: true,
    publish: true,
    comments: false,
    messaging: false,
    oauth: false,
    status: 'available',
    notes: 'Manual OAuth 1.0a credentials required.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    connect: true,
    publish: true,
    comments: false,
    messaging: true,
    oauth: true,
    status: 'available',
    notes: 'Connect via Meta to pick a WhatsApp Business phone number.',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    connect: true,
    publish: true,
    comments: true,
    messaging: false,
    oauth: true,
    status: 'available',
    notes:
      'Upload videos via YouTube Data API v3. Requires a Google Cloud project with YouTube API enabled.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    connect: true,
    publish: true,
    comments: false,
    messaging: false,
    oauth: true,
    status: 'available',
    notes:
      'OAuth + Content Posting API. Unaudited apps may be limited to private posts until TikTok app review approves video.publish.',
  },
  {
    id: 'google',
    label: 'Google',
    connect: true,
    publish: false,
    comments: false,
    messaging: false,
    oauth: true,
    status: 'coming_soon',
  },
  {
    id: 'email',
    label: 'Email',
    connect: false,
    publish: false,
    comments: false,
    messaging: false,
    oauth: false,
    status: 'coming_soon',
    notes: 'Copy generation only — sending not yet integrated.',
  },
  {
    id: 'ad_copy',
    label: 'Ad Copy',
    connect: false,
    publish: false,
    comments: false,
    messaging: false,
    oauth: false,
    status: 'coming_soon',
    notes: 'Copy generation only.',
  },
  {
    id: 'content',
    label: 'General',
    connect: false,
    publish: false,
    comments: false,
    messaging: false,
    oauth: false,
    status: 'available',
    notes: 'Templates and AI generation only.',
  },
];

export function capabilityOf(
  platformId: string,
): PlatformCapability | undefined {
  return PLATFORM_CAPABILITIES.find((p) => p.id === platformId);
}

export function isPublishSupported(platformId: string): boolean {
  const cap = capabilityOf(platformId);
  return Boolean(cap?.publish && cap.status === 'available');
}
