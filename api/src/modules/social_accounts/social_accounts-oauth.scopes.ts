/**
 * Publisher OAuth scopes — requested at connect time so posting works without a second consent flow.
 * Register these permissions in each provider's developer console and submit for App Review before production.
 */

/** Post to Facebook Pages + read/reply to comments */
export const FACEBOOK_PUBLISHER_SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_show_list',
  'ads_management',
  'ads_read',
  'business_management',
] as const;

/**
 * Instagram Business publishing + comment management via Facebook Login (Graph API).
 * Requires a Facebook Page linked to an Instagram Professional account.
 */
export const INSTAGRAM_PUBLISHER_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'instagram_manage_messages',
] as const;

/**
 * LinkedIn connect + member posting.
 * Do NOT include r_member_social here — it requires LinkedIn Marketing API / partner approval
 * and causes unauthorized_scope_error on standard developer apps.
 * Comment read/reply needs separate partner access (see platform-capabilities notes).
 */
export const LINKEDIN_PUBLISHER_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
] as const;

/** Identity only — login / legacy Google connect */
export const GOOGLE_PUBLISHER_SCOPES = ['openid', 'email', 'profile'] as const;

/** YouTube Data API v3 — channel, upload, comments */
export const YOUTUBE_PUBLISHER_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
] as const;

/** TikTok Content Posting API — profile + direct video publish */
export const TIKTOK_PUBLISHER_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'video.upload',
  'video.publish',
] as const;

/** X (Twitter) OAuth 2.0 — always safe on standard developer apps */
export const TWITTER_PUBLISHER_BASE_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
] as const;

/** Requires X API DM access — enable with TWITTER_OAUTH_DM_SCOPES=true */
export const TWITTER_PUBLISHER_DM_SCOPES = ['dm.read', 'dm.write'] as const;

/** Full publisher scopes (base + DM). Prefer resolveTwitterPublisherScopes() at runtime. */
export const TWITTER_PUBLISHER_SCOPES = [
  ...TWITTER_PUBLISHER_BASE_SCOPES,
  ...TWITTER_PUBLISHER_DM_SCOPES,
] as const;

/** WhatsApp Business — list WABAs / phone numbers and send messages */
export const WHATSAPP_PUBLISHER_SCOPES = [
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
] as const;

export function scopesToParam(scopes: readonly string[]): string {
  return scopes.join(',');
}

/** Google OAuth requires space-delimited scopes (commas cause invalid_scope). */
export function googleScopesToParam(scopes: readonly string[]): string {
  return scopes.join(' ');
}

/** X OAuth 2.0 requires space-delimited scopes. */
export function twitterScopesToParam(scopes: readonly string[]): string {
  return scopes.join(' ');
}
