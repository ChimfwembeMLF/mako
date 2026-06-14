const LOGIN_CALLBACK_KEYS = [
  'GOOGLE_CALLBACK_URL',
  'FACEBOOK_CALLBACK_URL',
  'LINKEDIN_CALLBACK_URL',
  'INSTAGRAM_CALLBACK_URL',
] as const;

const PUBLISHER_CALLBACK_KEYS = [
  'GOOGLE_SOCIAL_CALLBACK_URL',
  'YOUTUBE_SOCIAL_CALLBACK_URL',
  'FACEBOOK_SOCIAL_CALLBACK_URL',
  'INSTAGRAM_SOCIAL_CALLBACK_URL',
  'LINKEDIN_SOCIAL_CALLBACK_URL',
  'TIKTOK_SOCIAL_CALLBACK_URL',
  'WHATSAPP_SOCIAL_CALLBACK_URL',
] as const;

/** Publisher callbacks required for oauth.ready (YouTube/Google optional). */
const REQUIRED_PUBLISHER_CALLBACK_KEYS = [
  'FACEBOOK_SOCIAL_CALLBACK_URL',
  'INSTAGRAM_SOCIAL_CALLBACK_URL',
  'LINKEDIN_SOCIAL_CALLBACK_URL',
  'WHATSAPP_SOCIAL_CALLBACK_URL',
] as const;

/** Warn when production OAuth redirect URIs still point at localhost (common .env.production mistake). */
export function warnProductionOAuthEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  for (const key of [...LOGIN_CALLBACK_KEYS, ...PUBLISHER_CALLBACK_KEYS]) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    if (/localhost|127\.0\.0\.1/i.test(value)) {
      console.warn(
        `[oauth] WARNING: ${key}=${value} — update to your public HTTPS domain and register it in the provider console`,
      );
    }
  }
}

function isLocalhostUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /localhost|127\.0\.0\.1/i.test(value);
}

/** Safe summary for /health — no secrets. */
export function summarizeOAuthEnv(): {
  ready: boolean;
  frontendUrl: string | null;
  apiPublicUrl: string | null;
  localhostCallbacks: string[];
  missingPublisherCallbacks: string[];
} {
  const localhostCallbacks: string[] = [];
  for (const key of [...LOGIN_CALLBACK_KEYS, ...PUBLISHER_CALLBACK_KEYS]) {
    const value = process.env[key]?.trim();
    if (isLocalhostUrl(value)) localhostCallbacks.push(key);
  }

  const missingPublisherCallbacks: string[] = [
    ...REQUIRED_PUBLISHER_CALLBACK_KEYS.filter((key) => !process.env[key]?.trim()),
  ];
  if (
    process.env.TIKTOK_CLIENT_KEY?.trim() &&
    !process.env.TIKTOK_SOCIAL_CALLBACK_URL?.trim()
  ) {
    missingPublisherCallbacks.push('TIKTOK_SOCIAL_CALLBACK_URL');
  }

  const frontendUrl = process.env.FRONTEND_URL?.trim() || null;
  const apiPublicUrl =
    process.env.API_PUBLIC_URL?.trim() || process.env.API_BASE_URL?.trim() || null;

  return {
    ready:
      localhostCallbacks.length === 0 &&
      missingPublisherCallbacks.length === 0 &&
      !!frontendUrl &&
      !isLocalhostUrl(frontendUrl),
    frontendUrl,
    apiPublicUrl,
    localhostCallbacks,
    missingPublisherCallbacks,
  };
}
