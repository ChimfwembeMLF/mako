import { createHmac, timingSafeEqual } from 'crypto';

/** Compares in constant time so a signature can't be guessed from response timing. */
export function isValidHmacSignature(
  secret: string,
  rawBody: Buffer | undefined,
  header: string | undefined,
  encoding: 'hex' | 'base64',
): boolean {
  if (!secret || !rawBody || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(rawBody).digest(encoding)}`,
  );
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
