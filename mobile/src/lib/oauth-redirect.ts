import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

/** Deep-link return URL for mobile OAuth (Expo Go, dev client, or production `mako://`). */
export function getMobileOAuthReturnUrl(path = 'callback'): string {
  return makeRedirectUri({
    scheme: 'mako',
    path,
    preferLocalhost: true,
  });
}

export function parseAuthCallbackFromUrl(url: string): { token?: string; error?: string } {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const err = params.error;
  if (err) {
    return { error: decodeURIComponent(typeof err === 'string' ? err : String(err)) };
  }
  const token = params.token;
  if (token && typeof token === 'string') {
    return { token };
  }
  return {};
}

export function isAuthCallbackUrl(url: string, returnUrl: string): boolean {
  if (url.includes('token=') || url.includes('error=')) {
    const base = returnUrl.split('?')[0];
    if (url.startsWith(base)) return true;
    if (url.includes('/callback')) return true;
  }
  return false;
}
