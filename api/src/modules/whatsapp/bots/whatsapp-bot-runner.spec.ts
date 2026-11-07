import { WhatsappBotRunner, isRealQuestion, type AgentCaller } from './whatsapp-bot-runner';
import { validateBotGraph, fillVariables, type BotGraph } from './whatsapp-bot.types';
import { menuGraph, templateGraph } from './whatsapp-bot.templates';

const noAgent: AgentCaller = async () => ({ reply: 'agent reply', actions: [] });

const graph: BotGraph = {
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
    { id: 'hello', type: 'message', position: { x: 0, y: 0 }, data: { text: 'Welcome!' } },
    { id: 'pick', type: 'buttons', position: { x: 0, y: 0 }, data: { text: 'What do you need?', options: [{ id: 'buy', title: 'Buy' }, { id: 'help', title: 'Help' }] } },
    { id: 'name', type: 'ask', position: { x: 0, y: 0 }, data: { text: 'Your email?', variable: 'email', validation: 'email' } },
    { id: 'vip', type: 'condition', position: { x: 0, y: 0 }, data: { rules: [{ source: 'email', operator: 'contains', value: '@vip.' }] } },
    { id: 'vip_msg', type: 'end', position: { x: 0, y: 0 }, data: { text: 'Hello VIP {{email}}' } },
    { id: 'normal', type: 'end', position: { x: 0, y: 0 }, data: { text: 'Thanks {{email}}' } },
    { id: 'person', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
  ],
  edges: [
    { id: '1', source: 'start', target: 'hello' },
    { id: '2', source: 'hello', target: 'pick' },
    { id: '3', source: 'pick', target: 'name', sourceHandle: 'buy' },
    { id: '4', source: 'pick', target: 'person', sourceHandle: 'help' },
    { id: '5', source: 'name', target: 'vip' },
    { id: '6', source: 'vip', target: 'vip_msg', sourceHandle: 'true' },
    { id: '7', source: 'vip', target: 'normal', sourceHandle: 'false' },
  ],
};

describe('WhatsappBotRunner', () => {
  it('sends blocks until one needs a reply, then waits there', async () => {
    const r = await new WhatsappBotRunner(graph, noAgent).start('bot1', 'hi');
    expect(r.messages.map((m) => m.kind)).toEqual(['text', 'buttons']);
    expect(r.messages[1]).toMatchObject({ buttons: [{ id: 'pick::buy', title: 'Buy' }, { id: 'pick::help', title: 'Help' }] });
    expect(r.state.nodeId).toBe('pick');
    expect(r.ended).toBe(false);
  });

  it('follows the branch for a tapped button, typed title or option number', async () => {
    const runner = new WhatsappBotRunner(graph, noAgent);
    const first = await runner.start('bot1', 'hi');
    for (const [text, id] of [['', 'pick::buy'], ['buy', undefined], ['1', undefined]] as const) {
      const r = await runner.resume(first.state, text, id);
      expect(r.state.nodeId).toBe('name');
    }
  });

  it('asks again when the reply matches no option', async () => {
    const runner = new WhatsappBotRunner(graph, noAgent);
    const first = await runner.start('bot1', 'hi');
    const r = await runner.resume(first.state, 'maybe');
    expect(r.state.nodeId).toBe('pick');
    expect(r.messages[0]).toMatchObject({ body: 'Please choose one of the options below.' });
  });

  it('validates answers, saves them, and branches on conditions', async () => {
    const runner = new WhatsappBotRunner(graph, noAgent);
    const atAsk = await runner.resume((await runner.start('b', 'hi')).state, 'Buy');

    const bad = await runner.resume(atAsk.state, 'not an email');
    expect(bad.state.nodeId).toBe('name');

    const vip = await runner.resume(atAsk.state, 'ceo@vip.co');
    expect(vip.messages.at(-1)).toMatchObject({ body: 'Hello VIP ceo@vip.co' });
    expect(vip.ended).toBe(true);

    const normal = await runner.resume(atAsk.state, 'jane@mail.com');
    expect(normal.messages.at(-1)).toMatchObject({ body: 'Thanks jane@mail.com' });
  });

  it('hands off to a person and stays quiet for a while', async () => {
    const runner = new WhatsappBotRunner(graph, noAgent);
    const r = await runner.resume((await runner.start('b', 'hi')).state, 'Help');
    expect(r.handoff).toBe(true);
    expect(new Date(r.state.handoffUntil!).getTime()).toBeGreaterThan(Date.now());
  });

  it('stops a looping flow instead of spamming the customer', async () => {
    const loop: BotGraph = {
      nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
        { id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'again' } },
        { id: 'g', type: 'goto', position: { x: 0, y: 0 }, data: { targetNodeId: 'm' } },
      ],
      edges: [{ id: '1', source: 'start', target: 'm' }, { id: '2', source: 'm', target: 'g' }],
    };
    const r = await new WhatsappBotRunner(loop, noAgent).start('b', 'hi');
    expect(r.messages.length).toBeLessThanOrEqual(15);
    expect(r.ended).toBe(true);
  });

  it('lets the AI agent talk, save a lead, and leave on an exit keyword', async () => {
    const agent = templateGraph('agent', 'Chilenje');
    const calls: string[] = [];
    const caller: AgentCaller = async (_n, history) => {
      calls.push(history.at(-1)!.content);
      return { reply: 'Noted!', lead: { name: 'Jane', email: 'jane@mail.com' }, actions: [{ name: 'save_lead', ok: true, detail: 'Lead saved' }] };
    };
    const runner = new WhatsappBotRunner(agent, caller);
    const opened = await runner.start('b', 'hi');
    expect(opened.state.nodeId).toBe('agent');

    const turn = await runner.resume(opened.state, "I'm Jane, jane@mail.com");
    expect(turn.messages).toEqual([{ kind: 'text', body: 'Noted!' }]);
    expect(turn.lead).toEqual({ name: 'Jane', email: 'jane@mail.com' });
    expect(turn.state.agentHistory.map((t) => t.role)).toEqual(['customer', 'agent']);

    const left = await runner.resume(turn.state, 'stop');
    expect(left.ended).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('follows the agent handoff exit when the agent asks for a person', async () => {
    const agent = templateGraph('agent');
    const runner = new WhatsappBotRunner(agent, async () => ({ reply: 'One moment', handoff: true, actions: [] }));
    const r = await runner.resume((await runner.start('b', 'hi')).state, 'I want a human');
    expect(r.handoff).toBe(true);
  });
});

describe('validateBotGraph', () => {
  it('accepts the starter templates', () => {
    for (const t of ['menu', 'agent', 'lead_capture'] as const) expect(validateBotGraph(templateGraph(t))).toEqual([]);
  });

  it('accepts a converted menu bot', () => {
    const g = menuGraph([{ id: 'a', title: 'Prices', response: 'R100' }, { id: 'b', title: 'Ask us', response: 'Help them', aiGenerate: true }], 'Hi');
    expect(validateBotGraph(g)).toEqual([]);
  });

  it('enforces WhatsApp limits and unconnected options', () => {
    const g: BotGraph = {
      nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', type: 'buttons', position: { x: 0, y: 0 }, data: { text: 'Pick', options: [1, 2, 3, 4].map((i) => ({ id: `o${i}`, title: `Option number ${i} is too long` })) } },
      ],
      edges: [{ id: '1', source: 'start', target: 'b' }],
    };
    const messages = validateBotGraph(g).map((p) => p.message).join('\n');
    expect(messages).toContain('at most 3 options');
    expect(messages).toContain('over 20 characters');
    expect(messages).toContain('connect');
  });

  it('rejects custom actions that are not public https URLs', () => {
    const g = templateGraph('agent');
    g.nodes.find((n) => n.id === 'agent')!.data.customActions = [{ name: 'check_order', description: 'x', url: 'http://internal', parameters: [] }];
    expect(validateBotGraph(g).map((p) => p.message).join()).toContain('https://');
  });
});

describe('fillVariables', () => {
  it('fills known answers and blanks unknown ones', () => {
    expect(fillVariables('Hi {{ full_name }}, {{missing}}!', { full_name: 'Jane' })).toBe('Hi Jane, !');
  });
});

describe('WhatsappBotRunner AI agent entry', () => {
  const agentGraph = templateGraph('agent', 'Chilenje Roasters');

  it("answers a customer's opening question instead of only greeting", async () => {
    const caller: AgentCaller = jest.fn(async () => ({ reply: 'Yes, we deliver to Kitwe on Fridays.', actions: [] }));
    const r = await new WhatsappBotRunner(agentGraph, caller).start('bot1', 'Do you deliver to Kitwe?');
    expect(r.messages.map((m) => m.body)).toEqual(['Yes, we deliver to Kitwe on Fridays.']);
    expect(caller).toHaveBeenCalledTimes(1);
  });

  it('greets a plain hello without calling the AI', async () => {
    const caller: AgentCaller = jest.fn(async () => ({ reply: 'x', actions: [] }));
    const r = await new WhatsappBotRunner(agentGraph, caller).start('bot1', 'hi');
    expect(r.messages).toHaveLength(1);
    expect(caller).not.toHaveBeenCalled();
  });

  it('sends one message, not two, when the agent hands over', async () => {
    const caller: AgentCaller = async () => ({ reply: "I'll get someone from the team for you.", handoff: true, actions: [] });
    const r = await new WhatsappBotRunner(agentGraph, caller).start('bot1', 'I want to talk to a person please');
    expect(r.handoff).toBe(true);
    expect(r.messages.map((m) => m.body)).toEqual(["I'll get someone from the team for you."]);
  });

  it('tells real questions from greetings', () => {
    expect(isRealQuestion('Hello!')).toBe(false);
    expect(isRealQuestion('menu')).toBe(false);
    expect(isRealQuestion('price?')).toBe(true);
    expect(isRealQuestion('I need coffee beans')).toBe(true);
  });
});
