import type { Request, Response } from 'express';
import { parseCookies } from './oauth-cookie-state.store';

export const MOBILE_OAUTH_RETURN_COOKIE = 'mako.oauth.mobile_return';

/** Deep links (mako://, exp://) and localhost only — never arbitrary web origins. */
export function isAllowedMobileOAuthReturnUrl(returnUrl: string): boolean {
  if (/^mako:\/\//.test(returnUrl)) return true;
  if (/^exp[s]?:\/\//.test(returnUrl)) return true;
  try {
    const u = new URL(returnUrl);
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Reads the mobile return URL set by /auth/google/mobile. Parses the Cookie header
 * directly — the app does not mount cookie-parser, so req.cookies is undefined.
 */
export function readMobileOAuthReturnUrl(req: Request): string | null {
  const value = parseCookies(req)[MOBILE_OAUTH_RETURN_COOKIE];
  return value && isAllowedMobileOAuthReturnUrl(value) ? value : null;
}

export function clearMobileOAuthReturnCookie(res: Response): void {
  res.clearCookie(MOBILE_OAUTH_RETURN_COOKIE, {
    path: '/',
    sameSite: 'none',
    secure: true,
  });
}

export function appendQuery(url: string, query: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}
