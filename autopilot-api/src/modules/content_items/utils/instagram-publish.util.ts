type MediaLike = { media_type?: string; type?: string };

/** Instagram Graph API requires at least one image or video. */
export function instagramRequiresMedia(platform: string): boolean {
  return platform.toLowerCase() === 'instagram';
}

export function hasPublishableMedia(media: MediaLike[]): boolean {
  return media.some((m) => {
    const t = (m.media_type ?? m.type ?? 'image').toLowerCase();
    return t === 'image' || t === 'video';
  });
}
