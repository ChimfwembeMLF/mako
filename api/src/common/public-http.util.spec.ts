import { assertPublicUrl, isPublicAddress } from './public-http.util';

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    'not-an-ip',
  ])('rejects %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])(
    'allows %s',
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
});

describe('assertPublicUrl', () => {
  it.each([
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:3000/',
    'http://2130706433/',
    'http://0x7f.1/',
    'file:///etc/passwd',
  ])('rejects %s', (url) => {
    expect(() => assertPublicUrl(url)).toThrow();
  });

  it('leaves public URLs and hostnames alone', () => {
    expect(() => assertPublicUrl('https://example.com/about')).not.toThrow();
    expect(() => assertPublicUrl('http://8.8.8.8/')).not.toThrow();
  });
});
