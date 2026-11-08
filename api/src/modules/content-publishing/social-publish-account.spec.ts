jest.mock('uuid', () => ({ v1: () => 'id', v4: () => 'id' }));
jest.mock('@mistralai/mistralai', () => ({}));
jest.mock('../chatbot/utils/avatar-model-compress.util', () => ({}));
jest.mock('axios');
import axios from 'axios';

import {
  SocialPublishAccountService,
  pickDefaultAccount,
} from './social-publish-account.service';

describe('pickDefaultAccount', () => {
  const a = { id: 'a', userId: 'u1', metadata: {} };
  const b = { id: 'b', userId: 'u2', metadata: { is_default: true } };
  const c = { id: 'c', userId: 'u3', metadata: {} };

  it('uses the workspace default first', () => {
    expect(pickDefaultAccount([a, b, c], 'u3')?.id).toBe('b');
  });
  it("then the poster's own account, then the oldest", () => {
    expect(pickDefaultAccount([a, c], 'u3')?.id).toBe('c');
    expect(pickDefaultAccount([a, c], 'u9')?.id).toBe('a');
    expect(pickDefaultAccount([], 'u9')).toBeNull();
  });
});

describe('SocialPublishAccountService.getForPublish', () => {
  function make(rows: Array<Record<string, unknown>>) {
    const repo = {
      findOne: jest.fn(
        async ({ where }: any) =>
          rows.find(
            (r) =>
              r.id === where.id &&
              r.connected === true &&
              r.platform === where.platform,
          ) ?? null,
      ),
      find: jest.fn(async () => rows.filter((r) => r.connected)),
    };
    const svc = new SocialPublishAccountService(
      repo as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(svc, 'prepareAccount').mockImplementation(async (acc) => acc);
    return svc;
  }

  it('posts from the chosen account', async () => {
    const svc = make([
      {
        id: 'p1',
        platform: 'facebook',
        connected: true,
        userId: 'u1',
        metadata: {},
      },
      {
        id: 'p2',
        platform: 'facebook',
        connected: true,
        userId: 'u1',
        metadata: {},
      },
    ]);
    expect(
      (await svc.getForPublish('t1', 'u1', 'facebook', 'w1', 'p2'))?.id,
    ).toBe('p2');
  });

  it('never swaps a disconnected chosen account for another one', async () => {
    const svc = make([
      {
        id: 'p1',
        platform: 'facebook',
        connected: true,
        userId: 'u1',
        metadata: {},
      },
      {
        id: 'p2',
        platform: 'facebook',
        connected: false,
        userId: 'u1',
        metadata: {},
      },
    ]);
    expect(
      await svc.getForPublish('t1', 'u1', 'facebook', 'w1', 'p2'),
    ).toBeNull();
  });

  it('uses the default when no account is chosen', async () => {
    const svc = make([
      {
        id: 'p1',
        platform: 'facebook',
        connected: true,
        userId: 'u1',
        metadata: {},
      },
      {
        id: 'p2',
        platform: 'facebook',
        connected: true,
        userId: 'u2',
        metadata: { is_default: true },
      },
    ]);
    expect((await svc.getForPublish('t1', 'u1', 'facebook', 'w1'))?.id).toBe(
      'p2',
    );
  });
});

describe('SocialPublishAccountService.postFirstComment', () => {
  const svc = new SocialPublishAccountService(
    {} as never,
    {} as never,
    {} as never,
  );
  beforeEach(() => jest.resetAllMocks());

  it('comments under a Facebook post with the Page token', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { id: 'c1' } });
    const ok = await svc.postFirstComment(
      { metadata: { page_token: 'page' } } as never,
      'facebook',
      'post_1',
      ' Order at the link ',
    );
    expect(ok).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/post_1/comments'),
      null,
      expect.objectContaining({
        params: { message: 'Order at the link', access_token: 'page' },
      }),
    );
  });

  it('reports failure without throwing, so the post still counts as published', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('nope'));
    expect(
      await svc.postFirstComment(
        { metadata: { page_token: 'page' } } as never,
        'instagram',
        'm1',
        'Hi',
      ),
    ).toBe(false);
  });

  it('skips channels that do not support it', async () => {
    expect(
      await svc.postFirstComment({} as never, 'linkedin', 'u1', 'Hi'),
    ).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
