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
