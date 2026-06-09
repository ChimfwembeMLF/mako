/**
 * Publisher OAuth scopes — requested at connect time so posting works without a second consent flow.
 * Register these permissions in each provider's developer console and submit for App Review before production.
 */

/** Post to Facebook Pages + resolve Page tokens (no user `email` — not in Page use case by default) */
export const FACEBOOK_PUBLISHER_SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_show_list',
] as const;

/**
 * Instagram Business publishing via Facebook Login (Graph API).
 * Requires a Facebook Page linked to an Instagram Professional account.
 * Add these permissions under Use cases → Instagram / Manage your Page in Meta App Dashboard.
 */
export const INSTAGRAM_PUBLISHER_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
] as const;

/** Post to LinkedIn member profile (UGC API) */
export const LINKEDIN_PUBLISHER_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
] as const;

/** Identity only — no Google posting target in API yet */
export const GOOGLE_PUBLISHER_SCOPES = [
  'openid',
  'email',
  'profile',
] as const;

export function scopesToParam(scopes: readonly string[]): string {
  return scopes.join(',');
}
