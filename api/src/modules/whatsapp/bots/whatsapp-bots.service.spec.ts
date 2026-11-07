jest.mock('../whatsapp-messaging.service', () => ({ WhatsappMessagingService: class {} }));
jest.mock('../whatsapp-flow-session.service', () => ({ WhatsappFlowSessionService: class {} }));
jest.mock('./whatsapp-bot-agent.service', () => ({ WhatsappBotAgentService: class {} }));
jest.mock('../../leads/leads.service', () => ({ LeadsService: class {} }));
jest.mock('../../brand_profiles/brand_profiles.service', () => ({ BrandProfilesService: class {} }));

import { WhatsappBotsService } from './whatsapp-bots.service';
import { templateGraph } from './whatsapp-bot.templates';
import type { BotGraph } from './whatsapp-bot.types';

const greet = (text: string): BotGraph => ({
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
    { id: 'm', type: 'end', position: { x: 0, y: 0 }, data: { text } },
  ],
  edges: [{ id: 'e', source: 'start', target: 'm' }],
});

function bot(over: Record<string, unknown>) {
  return { id: 'b', tenantId: 't1', workspaceId: null, name: 'Bot', status: 'live', isDefault: false, triggers: [], graph: greet('hi'), ...over };
}

function setup(bots: Array<Record<string, unknown>>, session: Record<string, unknown> | null = null, opts: { failSends?: boolean } = {}) {
  const sent: string[] = [];
  const saved: Array<Record<string, unknown>> = [];
  const notifications = { notifyTenantAdmins: jest.fn(async () => undefined) };
  const repo = {
    find: jest.fn(async () => bots),
    count: jest.fn(async () => bots.filter((b) => b.status === 'live').length),
    findOne: jest.fn(async ({ where: { id } }: { where: { id: string } }) => bots.find((b) => b.id === id) ?? null),
    save: jest.fn(async (b: unknown) => b),
    update: jest.fn(async () => ({})),
  };
  const sessions = {
    getSession: jest.fn(async () => session),
    saveSession: jest.fn(async () => ({})),
    clearSession: jest.fn(async () => undefined),
  };
  const messaging = {
    sendSessionText: jest.fn(async (_c: unknown, _p: string, body: string) => {
      if (opts.failSends) return { success: false, error: 'Outside the 24-hour window' };
      sent.push(body);
      return { success: true, waMessageId: 'wamid.1' };
    }),
    sendInteractiveButtons: jest.fn(async () => ({ success: true })),
    sendInteractiveList: jest.fn(async () => ({ success: true })),
  };
  const leads = { update: jest.fn(async () => ({})) };
  const service = new WhatsappBotsService(
    repo as any,
    { save: jest.fn(async (x: Record<string, unknown>) => { saved.push(x); return x; }), create: (x: unknown) => x } as any,
    { findOne: jest.fn(async () => ({ ownerId: 'owner' })) } as any,
    sessions as any,
    messaging as any,
    { respond: jest.fn() } as any,
    leads as any,
    { resolveForContext: jest.fn(async () => null) } as any,
    notifications as any,
  );
  const inbound = (text: string) =>
    service.tryHandleInbound({ tenantId: 't1', phone: '+260971234567', text, creds: {} as any, leadId: 'lead1' });
  return { service, inbound, sent, saved, sessions, repo, leads, notifications };
}

describe('WhatsappBotsService routing', () => {
  const orders = bot({ id: 'orders', triggers: ['order', 'track order'], graph: greet('Orders bot') });
  const careers = bot({ id: 'jobs', triggers: ['jobs'], graph: greet('Careers bot') });
  const fallback = bot({ id: 'main', isDefault: true, graph: greet('Main bot') });

  it('starts the bot whose keyword the message begins with', async () => {
    const { inbound, sent } = setup([orders, careers, fallback]);
    expect(await inbound('Order 1234 please')).toBe(true);
    expect(sent).toEqual(['Orders bot']);
  });

  it('prefers the longest matching keyword', async () => {
    const tracker = bot({ id: 'track', triggers: ['track order status'], graph: greet('Tracker') });
    const { inbound, sent } = setup([orders, tracker]);
    await inbound('track order status 55');
    expect(sent).toEqual(['Tracker']);
  });

  it('sends everything else to the default bot', async () => {
    const { inbound, sent } = setup([orders, fallback]);
    await inbound('hello there');
    expect(sent).toEqual(['Main bot']);
  });

  it('leaves the message to the classic menu bot when no live bot applies', async () => {
    const { inbound } = setup([orders, bot({ id: 'draft', status: 'draft', isDefault: true })]);
    expect(await inbound('hello')).toBe(false);
  });

  it('stays quiet after a handoff unless the customer sends a keyword', async () => {
    const later = new Date(Date.now() + 3600_000).toISOString();
    const session = { context: { mode: 'bot', botId: 'main', nodeId: null, vars: {}, agentHistory: [], handoffUntil: later } };
    const quiet = setup([orders, fallback], session);
    expect(await quiet.inbound('are you there?')).toBe(true);
    expect(quiet.sent).toEqual([]);

    const restarted = setup([orders, fallback], session);
    await restarted.inbound('order');
    expect(restarted.sent).toEqual(['Orders bot']);
  });

  it('saves answers from a lead-capture bot onto the lead', async () => {
    const leadBot = bot({ id: 'lead', isDefault: true, graph: templateGraph('lead_capture') });
    const { inbound, sessions, leads } = setup([leadBot]);
    await inbound('hi');
    const at = (sessions.saveSession.mock.calls.at(-1) as unknown[])[3];
    // Answer the three questions by resuming from the saved state each time.
    let state = at;
    for (const answer of ['Jane Banda', 'Office coffee', 'jane@mail.com']) {
      const next = setup([leadBot], { context: state });
      await next.inbound(answer);
      state = (next.sessions.saveSession.mock.calls.at(-1) as unknown[] | undefined)?.[3] ?? state;
      if (answer === 'jane@mail.com') {
        expect(next.leads.update).toHaveBeenCalledWith('lead1', expect.objectContaining({ name: 'Jane Banda', email: 'jane@mail.com' }));
        expect(next.sessions.clearSession).toHaveBeenCalled();
      }
    }
    expect(leads.update).not.toHaveBeenCalled();
  });
});

describe('WhatsappBotsService publishing', () => {
  it('refuses a keyword another live bot already uses', async () => {
    const live = bot({ id: 'a', name: 'Orders', triggers: ['order'] });
    const draft = bot({ id: 'b', status: 'draft', triggers: ['order'], graph: templateGraph('menu') });
    const { service } = setup([live, draft]);
    await expect(service.publish('b')).rejects.toThrow('"order" already starts the live bot "Orders"');
  });

  it('refuses to publish a broken flow', async () => {
    const broken = bot({ id: 'x', status: 'draft', isDefault: true, graph: { nodes: [], edges: [] } });
    const { service } = setup([broken]);
    await expect(service.publish('x')).rejects.toThrow('Fix these before going live');
  });

  it('takes a live bot offline when an edit breaks it', async () => {
    const liveBot = bot({ id: 'l', isDefault: true, graph: templateGraph('agent') });
    const { service } = setup([liveBot]);
    const { bot: saved, problems } = await service.update('l', { graph: { nodes: [], edges: [] } });
    expect(problems.length).toBeGreaterThan(0);
    expect(saved.status).toBe('draft');
  });
});

describe('WhatsappBotsService linked bots', () => {
  const askThenLink = (target: string): BotGraph => ({
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
      { id: 'ask', type: 'ask', position: { x: 0, y: 0 }, data: { text: 'Name?', variable: 'full_name' } },
      { id: 'go', type: 'switch_bot', position: { x: 0, y: 0 }, data: { targetBotId: target } },
    ],
    edges: [{ id: '1', source: 'start', target: 'ask' }, { id: '2', source: 'ask', target: 'go' }],
  });
  const greeter: BotGraph = {
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
      { id: 'hi', type: 'ask', position: { x: 0, y: 0 }, data: { text: 'Hi {{full_name}}, what do you need?', variable: 'need' } },
    ],
    edges: [{ id: '1', source: 'start', target: 'hi' }],
  };

  it('continues in the linked bot with the answers carried over', async () => {
    const main = bot({ id: 'main', isDefault: true, graph: askThenLink('sub') });
    const sub = bot({ id: 'sub', status: 'draft', graph: greeter });
    const first = setup([main, sub]);
    await first.inbound('hello');
    const state = (first.sessions.saveSession.mock.calls.at(-1) as unknown[])[3];

    const next = setup([main, sub], { context: state });
    await next.inbound('Jane');
    expect(next.sent).toEqual(['Hi Jane, what do you need?']);
    const after = (next.sessions.saveSession.mock.calls.at(-1) as unknown[])[3] as { botId: string; nodeId: string };
    expect(after).toMatchObject({ botId: 'sub', nodeId: 'hi' });

    // The customer's next reply is handled by the linked draft bot.
    const third = setup([main, sub], { context: after });
    await third.inbound('Coffee beans');
    expect(third.sessions.clearSession).toHaveBeenCalled();
  });

  it('stops bots that link to each other instead of looping', async () => {
    const link = (target: string): BotGraph => ({
      nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
        { id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: `in ${target === 'a' ? 'b' : 'a'}` } },
        { id: 'go', type: 'switch_bot', position: { x: 0, y: 0 }, data: { targetBotId: target } },
      ],
      edges: [{ id: '1', source: 'start', target: 'm' }, { id: '2', source: 'm', target: 'go' }],
    });
    const a = bot({ id: 'a', isDefault: true, graph: link('b') });
    const b = bot({ id: 'b', status: 'draft', graph: link('a') });
    const { inbound, sent, sessions } = setup([a, b]);
    await inbound('hi');
    expect(sent.length).toBe(4);
    expect(sessions.clearSession).toHaveBeenCalled();
  });

  it('will not go live while a link points to a missing bot or to itself', async () => {
    const broken = bot({ id: 'x', status: 'draft', isDefault: true, graph: askThenLink('gone') });
    await expect(setup([broken]).service.publish('x')).rejects.toThrow('Fix these before going live');
    const self = bot({ id: 's', status: 'draft', isDefault: true, graph: askThenLink('s') });
    const { problems } = await setup([self]).service.update('s', {});
    expect(problems.map((p) => p.message).join()).toContain("can't go to itself");
  });
});


describe('WhatsappBotsService delivery and handoff', () => {
  const handoffGraph: BotGraph = {
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
      { id: 'h', type: 'handoff', position: { x: 0, y: 0 }, data: { text: 'Getting someone for you' } },
    ],
    edges: [{ id: 'e', source: 'start', target: 'h' }],
  };

  it('records a failed bot reply in the inbox instead of dropping it', async () => {
    const { inbound, saved } = setup([bot({ id: 'main', isDefault: true, graph: greet('Hello') })], null, { failSends: true });
    await inbound('hi');
    expect(saved).toEqual([expect.objectContaining({ status: 'failed', errorMessage: 'Outside the 24-hour window', body: 'Hello' })]);
  });

  it('tells the team once when a bot hands a customer over', async () => {
    const first = setup([bot({ id: 'main', isDefault: true, graph: handoffGraph })]);
    await first.inbound('I need a person');
    expect(first.notifications.notifyTenantAdmins).toHaveBeenCalledWith('t1', expect.objectContaining({ type: 'whatsapp_handoff' }));

    // Further messages during the quiet period don't alert again.
    const state = (first.sessions.saveSession.mock.calls.at(-1) as unknown[])[3];
    const later = setup([bot({ id: 'main', isDefault: true, graph: handoffGraph })], { context: state });
    await later.inbound('hello?');
    expect(later.notifications.notifyTenantAdmins).not.toHaveBeenCalled();
  });

  it('reports whether any visual bot is live, so the classic menu bot stays off', async () => {
    expect(await setup([bot({ id: 'a' })]).service.hasLiveBot('t1')).toBe(true);
    expect(await setup([bot({ id: 'a', status: 'draft' })]).service.hasLiveBot('t1')).toBe(false);
  });
});
