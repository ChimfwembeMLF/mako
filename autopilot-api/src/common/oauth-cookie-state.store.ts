import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'mako.oauth.state';
const MAX_AGE_SEC = 600;

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function resolveCookieSecure(): boolean {
  const raw = process.env.SESSION_SECURE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function appendCookie(res: Response, value: string, maxAgeSec: number): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (resolveCookieSecure()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function signState(state: string, secret: string): string {
  return createHmac('sha256', secret).update(state).digest('hex');
}

/**
 * Passport OAuth2 state store backed by a signed cookie instead of express-session.
 * Survives dev server restarts and avoids MemoryStore / multi-instance session loss.
 */
export class OAuthCookieStateStore {
  constructor(private readonly secret: string) {}

  store(
    req: Request,
    callback: (err: Error | null, state?: string) => void,
  ): void {
    const res = req.res;
    if (!res) {
      callback(new Error('Missing response for OAuth state cookie'));
      return;
    }

    const state = randomBytes(24).toString('hex');
    const signature = signState(state, this.secret);
    appendCookie(res, `${state}.${signature}`, MAX_AGE_SEC);
    callback(null, state);
  }

  verify(
    req: Request,
    providedState: string,
    callback: (
      err: Error | null,
      ok: boolean,
      info?: { message?: string },
    ) => void,
  ): void {
    const res = req.res;
    if (res) appendCookie(res, '', 0);

    const raw = parseCookies(req)[COOKIE_NAME];
    if (!raw || !providedState) {
      callback(null, false, {
        message: 'Unable to verify authorization request state.',
      });
      return;
    }

    const dot = raw.lastIndexOf('.');
    if (dot < 0) {
      callback(null, false, {
        message: 'Unable to verify authorization request state.',
      });
      return;
    }

    const state = raw.slice(0, dot);
    const signature = raw.slice(dot + 1);
    const expected = signState(state, this.secret);

    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      callback(null, false, {
        message: 'Invalid authorization request state.',
      });
      return;
    }

    if (state !== providedState) {
      callback(null, false, {
        message: 'Invalid authorization request state.',
      });
      return;
    }

    callback(null, true);
  }
}

export function createOAuthCookieStateStore(
  secret?: string,
): OAuthCookieStateStore {
  const resolved =
    secret?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    'dev_session_secret';
  return new OAuthCookieStateStore(resolved);
}
