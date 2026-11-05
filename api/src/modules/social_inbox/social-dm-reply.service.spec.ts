import axios from 'axios';
import { SocialDmReplyService } from './social-dm-reply.service';

jest.mock('./social-dm-auto-reply.service', () => ({ SocialDmAutoReplyService: class {} }));
jest.mock('../whatsapp/whatsapp-account-auth.service', () => ({ WhatsappAccountAuthService: class {} }));
jest.mock('../whatsapp/whatsapp-messaging.service', () => ({ WhatsappMessagingService: class {} }));

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { __esModule: true, default: { ...actual, post: jest.fn() }, isAxiosError: actual.isAxiosError };
});

const post = axios.post as jest.Mock;

function makeService(opts: { account?: object | null; lastInbound?: object | null }) {
  const socialRepo = { findOne: jest.fn().mockResolvedValue(opts.account ?? null) };
  const messagesRepo = {
    findOne: jest.fn().mockResolvedValue(opts.lastInbound ?? null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    update: jest.fn(),
  };
  const service = new SocialDmReplyService(
    socialRepo as never,
    messagesRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, messagesRepo };
}

const account = {
  workspaceId: 'ws1',
  platform: 'instagram',
  metadata: { page_id: 'PAGE1', page_token: 'TOKEN' },
};
const lastInbound = { participantId: 'IGSID1', participantName: 'thecodefatha' };
const base = { tenantId: 't1', userId: 'u1', workspaceId: 'ws1', message: 'Hi!' };

describe('SocialDmReplyService.sendReply (Meta)', () => {
  beforeEach(() => post.mockReset());

  it('sends from the linked Page, stores the reply and marks the thread read', async () => {
    post.mockResolvedValue({ data: { message_id: 'mid.1' } });
    const { service, messagesRepo } = makeService({ account, lastInbound });

    const res = await service.sendReply({ ...base, conversationId: 'dm:instagram:IGSID1' });

    expect(res).toEqual({ sent: true });
    expect(post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/PAGE1/messages',
      { recipient: { id: 'IGSID1' }, message: { text: 'Hi!' } },
      { params: { access_token: 'TOKEN' } },
    );
    expect(messagesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'outbound', externalMessageId: 'mid.1', threadId: 'IGSID1' }),
    );
    expect(messagesRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'IGSID1', status: 'received' }),
      { status: 'read' },
    );
  });

  it('explains the 24-hour window instead of throwing', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: { code: 10, error_subcode: 2018278, message: 'outside window' } } },
    });
    post.mockRejectedValue(err);
    const { service, messagesRepo } = makeService({ account, lastInbound });

    const res = await service.sendReply({ ...base, conversationId: 'dm:instagram:IGSID1' });

    expect(res.sent).toBe(false);
    expect(res.message).toMatch(/24 hours/);
    expect(messagesRepo.save).not.toHaveBeenCalled();
  });

  it('asks to connect the account when none is connected', async () => {
    const { service } = makeService({ account: null, lastInbound });
    const res = await service.sendReply({ ...base, conversationId: 'dm:instagram:IGSID1' });
    expect(res).toEqual({ sent: false, message: expect.stringMatching(/Connect Instagram/) });
    expect(post).not.toHaveBeenCalled();
  });
});
