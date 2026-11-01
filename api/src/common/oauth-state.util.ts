import { createHmac, timingSafeEqual } from 'crypto';

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/** OAuth state survives a trip through the browser, so it has to be tamper-proof. */
export function signOAuthState(data: Record<string, string>, secret: string): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyOAuthState(
  state: string | undefined,
  secret: string,
): Record<string, string> | null {
  const [payload, signature, extra] = (state ?? '').split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
