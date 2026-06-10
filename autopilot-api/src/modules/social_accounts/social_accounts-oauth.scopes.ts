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
] as const;

/** Post to LinkedIn member profile + read comments (reply API is limited) */
export const LINKEDIN_PUBLISHER_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
  'r_member_social',
] as const;

/** Identity only — no Google posting target in API yet */
export const GOOGLE_PUBLISHER_SCOPES = [
  'openid',
  'email',
  'profile',
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
