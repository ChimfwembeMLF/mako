jest.mock('uuid', () => ({ v1: () => 'id', v4: () => 'id' }));
jest.mock('@mistralai/mistralai', () => ({}));
jest.mock('../chatbot/utils/avatar-model-compress.util', () => ({}));
jest.mock('axios');

import axios from 'axios';
import {
  AccountHealth,
  SocialAccountHealthService,
  isAccessRefused,
  missingPermissions,
} from './social-account-health.service';
import { healthAlert } from '../jobs/social-account-health.cron';

const mockedAxios = axios as jest.Mocked<typeof axios>;

function service() {
  const repo = { save: jest.fn(async (x) => x) };
  const accounts = { refreshAccessTokenIfNeeded: jest.fn(async (a) => a) };
  return {
    svc: new SocialAccountHealthService(repo as never, accounts as never),
    repo,
  };
}

describe('missingPermissions', () => {
  it('names the features a missing permission breaks', () => {
    expect(
      missingPermissions('instagram', [
        'instagram_basic',
        'instagram_manage_comments',
      ]),
    ).toEqual([
      { feature: 'Posts', permissions: ['instagram_content_publish'] },
      { feature: 'Messages', permissions: ['instagram_manage_messages'] },
    ]);
  });
  it('says nothing when it does not know what was granted', () => {
    expect(missingPermissions('instagram', null)).toEqual([]);
  });
});

describe('isAccessRefused', () => {
  it('treats 401 and Meta token errors as lost access', () => {
    expect(isAccessRefused({ response: { status: 401 } })).toBe(true);
    expect(
      isAccessRefused({
        response: { status: 400, data: { error: { code: 190 } } },
      }),
    ).toBe(true);
  });
  it('does not treat a permission error or an outage as lost access', () => {
    expect(isAccessRefused({ response: { status: 403 } })).toBe(false);
    expect(
      isAccessRefused({
        response: { status: 400, data: { error: { code: 200 } } },
      }),
    ).toBe(false);
    expect(isAccessRefused(new Error('ETIMEDOUT'))).toBe(false);
  });
});

describe('SocialAccountHealthService.check', () => {
  beforeEach(() => jest.resetAllMocks());

  it('reports a working Facebook Page and the permissions it lacks, and saves the result', async () => {
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/me/permissions')) {
        return {
          data: {
            data: [
              { permission: 'pages_manage_posts', status: 'granted' },
              { permission: 'pages_show_list', status: 'granted' },
            ],
          },
        };
      }
      return { data: { id: 'p1', name: 'Acme' } };
    });
    const { svc, repo } = service();
    const account = {
      id: 'a1',
      platform: 'facebook',
      accessToken: 'user',
      metadata: { page_id: 'p1', page_token: 'page' },
    };
    const health = await svc.check(account as never);
    expect(health.status).toBe('ok');
    expect(health.missing).toEqual([
      {
        feature: 'Comments',
        permissions: ['pages_read_engagement', 'pages_manage_engagement'],
      },
    ]);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ health }),
      }),
    );
  });

  it('marks revoked access so the page asks to reconnect', async () => {
    mockedAxios.get.mockRejectedValue({ response: { status: 401 } });
    const { svc } = service();
    const health = await svc.check({
      id: 'a2',
      platform: 'linkedin',
      accessToken: 't',
      metadata: {},
    } as never);
    expect(health.status).toBe('revoked');
  });

  it("doesn't blame the account when the network is unreachable", async () => {
    mockedAxios.get.mockRejectedValue(new Error('ETIMEDOUT'));
    const { svc } = service();
    const health = await svc.check({
      id: 'a3',
      platform: 'linkedin',
      accessToken: 't',
      metadata: {},
    } as never);
    expect(health.status).toBe('error');
  });

  it("can't check X connected with saved credentials", async () => {
    const { svc } = service();
    const health = await svc.check({
      id: 'a4',
      platform: 'twitter',
      metadata: { auth_type: 'oauth1' },
    } as never);
    expect(health.status).toBe('unchecked');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});

describe('healthAlert', () => {
  const ok: AccountHealth = { status: 'ok', message: '', checkedAt: '', missing: [] };
  const revoked: AccountHealth = { ...ok, status: 'revoked' };
  const now = new Date('2026-11-08T03:00:00Z');

  it('alerts when access has just been lost, but not every night after', () => {
    const account = { platform: 'facebook', accountName: 'Acme', metadata: {} };
    expect(healthAlert(account as never, ok, revoked, now)?.title).toBe(
      'Facebook (Acme) needs reconnecting',
    );
    expect(healthAlert(account as never, revoked, revoked, now)).toBeNull();
  });

  it('warns once when access ends within a week', () => {
    const expiresAt = new Date('2026-11-12T03:00:00Z');
    const account = {
      platform: 'linkedin',
      accountName: 'Acme',
      expiresAt,
      metadata: {},
    };
    const alert = healthAlert(account as never, ok, ok, now);
    expect(alert?.title).toBe('LinkedIn (Acme) access ends in 4 days');
    expect(alert?.markExpiryWarned).toBe(expiresAt.toISOString());
    const warned = {
      ...account,
      metadata: { expiry_warned_for: expiresAt.toISOString() },
    };
    expect(healthAlert(warned as never, ok, ok, now)).toBeNull();
  });

  it('stays quiet when access is far from ending', () => {
    const account = {
      platform: 'linkedin',
      accountName: 'Acme',
      expiresAt: new Date('2027-01-04'),
      metadata: {},
    };
    expect(healthAlert(account as never, ok, ok, now)).toBeNull();
  });
});
