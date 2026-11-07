jest.mock('./whatsapp-messaging.service', () => ({ WhatsappMessagingService: class {} }));
jest.mock('./whatsapp-lead.service', () => ({ WhatsappLeadService: class {} }));
jest.mock('./whatsapp-auto-reply.service', () => ({ WhatsappAutoReplyService: class {} }));
jest.mock('./whatsapp-flow-engine.service', () => ({ WhatsappFlowEngineService: class {} }));
jest.mock('./bots/whatsapp-bots.service', () => ({ WhatsappBotsService: class {} }));

import { WhatsappInboundService } from './whatsapp-inbound.service';

const PLATFORM = { phoneNumberId: 'shared', accessToken: 't' };

function setup(opts: { tenants?: Array<{ id: string; slug: string }>; history?: { tenantId: string } | null; liveBot?: boolean } = {}) {
  const tenants = opts.tenants ?? [{ id: 'acme', slug: 'acme' }, { id: 'zed', slug: 'zed-coffee' }];
  const sent: string[] = [];
  const handled: string[] = [];
  const accounts = tenants.map((t) => ({ tenantId: t.id, workspaceId: null, metadata: { platform_managed: true } }));
  const accountsRepo = {
    find: jest.fn(async () => accounts),
    findOne: jest.fn(async ({ where }: { where: { tenantId: string } }) => accounts.find((a) => a.tenantId === where.tenantId) ?? null),
  };
  const contactsRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'c1', ...x })),
    create: (x: unknown) => x,
  };
  const messagesRepo = {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => (where.waMessageId ? null : opts.history ?? null)),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'm1', ...x })),
    create: (x: unknown) => x,
  };
  const tenantsRepo = {
    findOne: jest.fn(async ({ where }: { where: { slug: string } }) => tenants.find((t) => t.slug === where.slug) ?? null),
  };
  const messaging = {
    getPlatformCredentials: () => PLATFORM,
    normalizePhone: (p: string) => p.replace(/\D/g, ''),
    credentialsFromAccount: () => PLATFORM,
    sendSessionText: jest.fn(async (_c: unknown, _p: string, body: string) => { sent.push(body); return { success: true }; }),
  };
  const leads = { captureInbound: jest.fn(async () => 'lead1') };
  const bots = {
    tryHandleInbound: jest.fn(async ({ tenantId }: { tenantId: string }) => { handled.push(tenantId); return true; }),
    hasLiveBot: jest.fn(async () => opts.liveBot ?? false),
  };
  const service = new WhatsappInboundService(
    accountsRepo as any, contactsRepo as any, messagesRepo as any, tenantsRepo as any,
    messaging as any, leads as any, { tryReply: jest.fn() } as any, { tryHandleInbound: jest.fn(async () => false) } as any, bots as any,
  );
  const deliver = (text: string, id = 'wamid.x') =>
    service.handleMetaWebhook({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { metadata: { phone_number_id: 'shared' }, messages: [{ id, from: '260971234567', type: 'text', text: { body: text } }] } }] }],
    });
  return { deliver, sent, handled, bots };
}

describe('WhatsappInboundService on the shared Mako number', () => {
  it("sends a new customer's message to the workspace whose code it carries", async () => {
    const { deliver, handled } = setup();
    await deliver('Hi Zed Coffee! (ref:zed-coffee)');
    expect(handled).toEqual(['zed']);
  });

  it('keeps a returning customer with the workspace they last spoke to', async () => {
    const { deliver, handled } = setup({ history: { tenantId: 'acme' } });
    await deliver('hello again');
    expect(handled).toEqual(['acme']);
  });

  it('asks a new customer without a code to use the business link, once', async () => {
    const { deliver, handled, sent } = setup();
    await deliver('hello', 'w1');
    await deliver('anyone there?', 'w2');
    expect(handled).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('ref:');
    expect(sent[0]).not.toMatch(/acme|zed/i);
  });

  it('needs no code when only one workspace uses the shared number', async () => {
    const { deliver, handled } = setup({ tenants: [{ id: 'acme', slug: 'acme' }] });
    await deliver('hello');
    expect(handled).toEqual(['acme']);
  });
});
