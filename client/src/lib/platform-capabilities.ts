/**
 * Platform capability registry — mirrors API `GET /api/v1/platforms/capabilities`.
 * Only platforms with `publish: true` and `status: 'available'` appear in the publish picker.
 */

export type PlatformCapability = {
  id: string;
  label: string;
  connect: boolean;
  publish: boolean;
  comments: boolean;
  messaging: boolean;
  oauth: boolean;
  status: 'available' | 'coming_soon';
  notes?: string;
};

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
      'Publishing uses w_member_social. Comment sync/replies need LinkedIn Marketing API partner access, not standard OAuth.',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    connect: true,
    publish: true,
    comments: true,
    messaging: true,
    oauth: true,
    status: 'available',
    notes:
      'Connect with X OAuth 2.0 to post tweets and receive DMs/mentions in Social Inbox. Account Activity webhooks need OAuth 1.0a subscription tokens.',
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
    notes: 'Upload videos via YouTube Data API v3. Requires a Google Cloud project with YouTube API enabled.',
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
    connect: true,
    publish: false,
    comments: false,
    messaging: true,
    oauth: true,
    status: 'available',
    notes: 'Connect Gmail to send lead emails and configure email auto-replies.',
  },
  {
    id: 'ad_copy',
    label: 'Ad Copy',
    connect: false,
    publish: false,
    comments: false,
    messaging: false,
    oauth: false,
    status: 'available',
    notes: 'Generate headlines and primary text for Meta, LinkedIn, and Google Ads.',
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

export function capabilityOf(id: string): PlatformCapability | undefined {
  return PLATFORM_CAPABILITIES.find((p) => p.id === id);
}

export function publishablePlatforms(): PlatformCapability[] {
  return PLATFORM_CAPABILITIES.filter((p) => p.publish && p.status === 'available');
}

export function connectablePlatforms(): PlatformCapability[] {
  return PLATFORM_CAPABILITIES.filter((p) => p.connect && p.status === 'available');
}

export function commentReplyPlatforms(): PlatformCapability[] {
  return PLATFORM_CAPABILITIES.filter((p) => p.comments && p.status === 'available');
}

/** Platforms supported in auto-reply rules (comments + messaging). */
export function autoReplyPlatforms(): PlatformCapability[] {
  return PLATFORM_CAPABILITIES.filter(
    (p) => p.status === 'available' && (p.comments || p.messaging),
  );
}

export function templatePlatforms(): PlatformCapability[] {
  return PLATFORM_CAPABILITIES.filter(
    (p) => p.status === 'available' && (p.publish || ['email', 'ad_copy', 'content'].includes(p.id)),
  );
}
