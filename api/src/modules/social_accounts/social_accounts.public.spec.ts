// The service's heavy dependencies aren't needed to check what it hands to the browser.
jest.mock('uuid', () => ({ v1: () => 'id', v4: () => 'id' }));
jest.mock('@mistralai/mistralai', () => ({}));
jest.mock('../chatbot/utils/avatar-model-compress.util', () => ({}));

import { SocialAccountsService } from './social_accounts.service';

describe('SocialAccountsService.toPublicAccount', () => {
  const service = Object.create(
    SocialAccountsService.prototype,
  ) as SocialAccountsService;

  it('never returns tokens or saved credentials', () => {
    const out = service.toPublicAccount({
      id: 'a1',
      platform: 'twitter',
      accountName: 'Acme',
      accessToken: 'tok',
      refreshToken: 'ref',
      metadata: {
        api_key: 'k',
        api_secret: 's',
        access_token_secret: 'ts',
        access_token: 'wa-token',
        auth_type: 'oauth1',
        page_name: 'Acme Page',
        phone_number_id: '123',
      },
    } as never) as Record<string, unknown>;

    expect(out.accessToken).toBeUndefined();
    expect(out.refreshToken).toBeUndefined();
    expect(out.metadata).toEqual({
      auth_type: 'oauth1',
      page_name: 'Acme Page',
      phone_number_id: '123',
    });
  });

  it('copes with accounts that have no metadata', () => {
    const out = service.toPublicAccount({
      id: 'a2',
      platform: 'facebook',
      metadata: null,
    } as never) as Record<string, unknown>;
    expect(out.metadata).toBeNull();
  });
});
