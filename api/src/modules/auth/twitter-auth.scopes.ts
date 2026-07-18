/** X login OAuth 2.0 — profile only (no tweet.write). */
export const TWITTER_LOGIN_SCOPES = ['users.read', 'offline.access'] as const;

export function twitterLoginScopesParam(): string {
  return TWITTER_LOGIN_SCOPES.join(' ');
}
