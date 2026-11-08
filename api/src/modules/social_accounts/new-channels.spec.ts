import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { ChannelConnectorsService } from './channel-connectors.service';
import { TelegramConnectService } from './telegram-connect.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const config = (values: Record<string, string>) =>
  ({ get: (k: string) => values[k] } as any);
const BOT = '123456789:AAbbCCddEEffGGhhIIjjKKllMM';

describe('ChannelConnectorsService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const svc = new ChannelConnectorsService(
    config({
      LINKEDIN_CLIENT_ID: 'li-id',
      LINKEDIN_CLIENT_SECRET: 'li-secret',
      GOOGLE_CLIENT_ID: 'g-id',
      GOOGLE_CLIENT_SECRET: 'g-secret',
    }),
    jwt,
  );

  beforeEach(() => jest.resetAllMocks());

  it('builds the LinkedIn Pages authorize URL with organization scopes', () => {
    const url = new URL(
      svc.authorizeUrl('linkedin_page', 'st', 'https://api.example.com/cb'),
    );
    expect(url.host).toBe('www.linkedin.com');
    expect(url.searchParams.get('client_id')).toBe('li-id');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('scope')).toContain('w_organization_social');
  });

  it('asks Google for offline access so it gets a refresh token', () => {
    const url = new URL(
      svc.authorizeUrl('google_business', 'st', 'https://api.example.com/cb'),
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('explains missing app credentials instead of failing silently', () => {
    expect(() => svc.authorizeUrl('pinterest', 's', 'r')).toThrow(
      /PINTEREST_APP_ID/,
    );
  });

  it('lists the LinkedIn company Pages the user administers', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'tok', expires_in: 3600 },
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        elements: [
          {
            'organization~': {
              id: 42,
              localizedName: 'Acme',
              vanityName: 'acme',
            },
          },
          { 'organization~': undefined },
        ],
      },
    });
    const result = await svc.prepare(
      'linkedin_page',
      'code',
      'https://api.example.com/cb',
    );
    expect(result.kind).toBe('choose');
    if (result.kind !== 'choose') return;
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0]).toMatchObject({
      id: '42',
      name: 'Acme',
      account: {
        platform: 'linkedin',
        externalId: 'org-42',
        metadata: { organization_id: '42', kind: 'page' },
      },
    });
  });

  it('seals network tokens inside the setup token', () => {
    const token = svc.createSetupToken({
      userId: 'u1',
      tenantId: 't1',
      platform: 'linkedin',
      title: 'Pick',
      accessToken: 'very-secret-access-token',
      choices: [],
    });
    const [, body] = token.split('.');
    expect(Buffer.from(body, 'base64url').toString()).not.toContain(
      'very-secret-access-token',
    );
    expect(svc.verifySetupToken(token)).toMatchObject({
      type: 'channel_setup',
      userId: 'u1',
      accessToken: 'very-secret-access-token',
    });
  });

  it('rejects tampered or foreign setup tokens', () => {
    expect(() => svc.verifySetupToken('nope')).toThrow(BadRequestException);
    expect(() =>
      svc.verifySetupToken(jwt.sign({ type: 'youtube_setup' })),
    ).toThrow(BadRequestException);
  });
});

describe('TelegramConnectService', () => {
  const accounts = {
    connectAccount: jest.fn(async (x) => ({ id: 'acc', ...x })),
  };
  const svc = new TelegramConnectService(accounts as any);
  const base = { tenantId: 't1', userId: 'u1', botToken: BOT };

  beforeEach(() => {
    jest.resetAllMocks();
    accounts.connectAccount.mockImplementation(async (x) => ({
      id: 'acc',
      ...x,
    }));
  });

  const reply = (...results: unknown[]) => {
    for (const r of results)
      mockedAxios.post.mockResolvedValueOnce({ data: { ok: true, result: r } });
  };

  it('rejects text that is not a bot token without calling Telegram', async () => {
    await expect(
      svc.connect({ ...base, botToken: 'hello', chat: '@c' }),
    ).rejects.toThrow(/bot token/);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('connects a channel where the bot is an admin that can post', async () => {
    reply(
      { id: 9, username: 'mako_bot' },
      { id: -1001, title: 'News', username: 'news', type: 'channel' },
      { status: 'administrator', can_post_messages: true },
    );
    await svc.connect({ ...base, chat: 'https://t.me/news' });
    expect(mockedAxios.post.mock.calls[1][1]).toEqual({ chat_id: '@news' });
    expect(accounts.connectAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'telegram',
        externalId: '-1001',
        accessToken: BOT,
        metadata: expect.objectContaining({
          chat_id: '-1001',
          bot_username: 'mako_bot',
        }),
      }),
    );
  });

  it('refuses a channel where the bot is only a member', async () => {
    reply(
      { id: 9, username: 'mako_bot' },
      { id: -1001, title: 'News', type: 'channel' },
      { status: 'member' },
    );
    await expect(svc.connect({ ...base, chat: '@news' })).rejects.toThrow(
      /admin/,
    );
    expect(accounts.connectAccount).not.toHaveBeenCalled();
  });

  it('never puts the token in the error message', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      message: `POST https://api.telegram.org/bot${BOT}/getMe 401`,
      response: { data: { description: 'Unauthorized' } },
    });
    const err = await svc.connect({ ...base, chat: '@news' }).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(String(err.message)).not.toContain(BOT);
  });
});
