import axios from 'axios';
import {
  NewChannelPublishingService,
  CHANNEL_TEXT_LIMITS,
} from './new-channel-publishing.service';

jest.mock('axios');
jest.mock('./publish-media-resolver.service', () => ({
  PublishMediaResolverService: class {},
}));
jest.mock('./social-publish-account.service', () => ({
  SocialPublishAccountService: class {},
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BOT = '123456789:AAbbCCddEEffGGhhIIjjKKllMM';
const content = {
  id: 'c1',
  content: 'Hello world',
  userId: 'u1',
  tenantId: 't1',
  workspaceId: 'w1',
};
const image = {
  id: 'm1',
  media_url: 'https://cdn.example.com/a.jpg',
  media_type: 'image' as const,
};

const make = (account: Record<string, unknown> | null) => {
  const accounts = { getForPublish: jest.fn().mockResolvedValue(account) };
  const mediaResolver = { resolveForPublish: jest.fn(async (m) => m) };
  return {
    svc: new NewChannelPublishingService(accounts as any, mediaResolver as any),
    accounts,
  };
};

describe('NewChannelPublishingService', () => {
  beforeEach(() => jest.resetAllMocks());

  it('passes the chosen account through to the lookup', async () => {
    const { svc, accounts } = make(null);
    const res = await svc.publishThreads({ ...content, accountId: 'acc-2' });
    expect(accounts.getForPublish).toHaveBeenCalledWith(
      't1',
      'u1',
      'threads',
      'w1',
      'acc-2',
    );
    expect(res.published).toBe(false);
  });

  it('publishes a text post to Threads in two steps', async () => {
    const { svc } = make({ accessToken: 'tok', externalId: 'th-1' });
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'container' } })
      .mockResolvedValueOnce({ data: { id: 'post-1' } });
    const res = await svc.publishThreads(content);
    expect(res).toMatchObject({ published: true, externalPostId: 'post-1' });
    expect(mockedAxios.post.mock.calls[0][2]?.params).toMatchObject({
      media_type: 'TEXT',
      text: 'Hello world',
    });
    expect(mockedAxios.post.mock.calls[1][2]?.params).toMatchObject({
      creation_id: 'container',
    });
  });

  it('clips Threads posts to the character limit', async () => {
    const { svc } = make({ accessToken: 'tok', externalId: 'th-1' });
    mockedAxios.post.mockResolvedValue({ data: { id: 'x' } });
    await svc.publishThreads({ ...content, content: 'a'.repeat(900) });
    expect(
      (mockedAxios.post.mock.calls[0][2]?.params as any).text,
    ).toHaveLength(CHANNEL_TEXT_LIMITS.threads);
  });

  it('needs an image and a board for Pinterest', async () => {
    const noBoard = make({ accessToken: 'tok', metadata: {} });
    expect(
      (await noBoard.svc.publishPinterest(content, [image])).message,
    ).toMatch(/board/);
    const board = make({ accessToken: 'tok', metadata: { board_id: 'b1' } });
    expect((await board.svc.publishPinterest(content)).message).toMatch(
      /image/,
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('pins to the saved board', async () => {
    const { svc } = make({ accessToken: 'tok', metadata: { board_id: 'b1' } });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 'pin-1' } });
    const res = await svc.publishPinterest(content, [image]);
    expect(res).toMatchObject({ published: true, externalPostId: 'pin-1' });
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({
      board_id: 'b1',
      media_source: { url: image.media_url },
    });
  });

  it('posts to the chosen Google Business location', async () => {
    const { svc } = make({
      accessToken: 'tok',
      metadata: { location_name: 'accounts/1/locations/2' },
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: { name: 'accounts/1/locations/2/localPosts/3' },
    });
    const res = await svc.publishGoogleBusiness(content, [image]);
    expect(res.published).toBe(true);
    expect(mockedAxios.post.mock.calls[0][0]).toBe(
      'https://mybusiness.googleapis.com/v4/accounts/1/locations/2/localPosts',
    );
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({
      summary: 'Hello world',
      media: [{ mediaFormat: 'PHOTO' }],
    });
  });

  it('sends a photo with a caption to Telegram', async () => {
    const { svc } = make({ accessToken: BOT, metadata: { chat_id: '-1001' } });
    mockedAxios.post.mockResolvedValueOnce({
      data: { result: { message_id: 77 } },
    });
    const res = await svc.publishTelegram(content, [image]);
    expect(res).toMatchObject({ published: true, externalPostId: '77' });
    expect(mockedAxios.post.mock.calls[0][0]).toMatch(/\/sendPhoto$/);
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({
      chat_id: '-1001',
      caption: 'Hello world',
    });
  });

  it('keeps the Telegram bot token out of failure messages', async () => {
    const { svc } = make({ accessToken: BOT, metadata: { chat_id: '-1001' } });
    mockedAxios.post.mockRejectedValueOnce(
      new Error(
        `connect ECONNRESET https://api.telegram.org/bot${BOT}/sendMessage`,
      ),
    );
    const res = await svc.publishTelegram(content);
    expect(res.published).toBe(false);
    expect(res.message).not.toContain(BOT);
  });
});
