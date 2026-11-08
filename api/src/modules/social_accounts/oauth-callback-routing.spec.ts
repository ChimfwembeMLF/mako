import { callbackHost } from './social_accounts-oauth.service';

jest.mock('uuid', () => ({ v1: () => 'id', v4: () => 'id' }));

describe('callbackHost', () => {
  it('sends Google Business through the registered Google callback', () => {
    expect(callbackHost('google_business')).toBe('google');
  });

  it('sends LinkedIn company Pages through the registered LinkedIn callback', () => {
    expect(callbackHost('linkedin_page')).toBe('linkedin');
  });

  it('leaves providers with their own apps on their own callback', () => {
    for (const p of [
      'instagram_login',
      'threads',
      'pinterest',
      'google',
      'facebook',
    ] as const) {
      expect(callbackHost(p)).toBe(p);
    }
  });
});
