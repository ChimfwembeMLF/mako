import { createHmac } from 'crypto';
import { isValidHmacSignature } from './webhook-signature.util';

const body = Buffer.from('{"a":1}');
const sign = (secret: string, encoding: 'hex' | 'base64') =>
  `sha256=${createHmac('sha256', secret).update(body).digest(encoding)}`;

describe('isValidHmacSignature', () => {
  it.each(['hex', 'base64'] as const)('accepts a correct %s signature', (encoding) => {
    expect(isValidHmacSignature('s', body, sign('s', encoding), encoding)).toBe(true);
  });

  it('rejects a signature made with another secret', () => {
    expect(isValidHmacSignature('s', body, sign('other', 'hex'), 'hex')).toBe(false);
  });

  it('rejects a changed body', () => {
    expect(isValidHmacSignature('s', Buffer.from('{"a":2}'), sign('s', 'hex'), 'hex')).toBe(false);
  });

  it.each([
    ['no header', undefined],
    ['wrong format', 'abc'],
    ['wrong length', 'sha256=abc'],
  ])('rejects %s', (_label, header) => {
    expect(isValidHmacSignature('s', body, header, 'hex')).toBe(false);
  });

  it('rejects everything when no secret or body is available', () => {
    expect(isValidHmacSignature('', body, sign('', 'hex'), 'hex')).toBe(false);
    expect(isValidHmacSignature('s', undefined, sign('s', 'hex'), 'hex')).toBe(false);
  });
});
