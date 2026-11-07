jest.mock('../../ai/services/ai-provider-router.service', () => ({ AiProviderRouter: class {} }));
jest.mock('../../ai/services/ai-usage-tracker.service', () => ({ AiUsageTrackerService: class {} }));
jest.mock('../../brand_profiles/brand_profiles.service', () => ({ BrandProfilesService: class {} }));
jest.mock('../../chatbot/services/vector-store.service', () => ({ VectorStoreService: class {} }));
jest.mock('../../chatbot/services/knowledge-embedding.service', () => ({ KnowledgeEmbeddingService: class {} }));

import { WhatsappBotAgentService, detailsShared } from './whatsapp-bot-agent.service';

function setup(opts: { decisions?: unknown[]; aiError?: Error; overLimit?: boolean } = {}) {
  const decisions = [...(opts.decisions ?? [])];
  const ai = {
    completeJson: jest.fn(async () => {
      if (opts.aiError) throw opts.aiError;
      return { data: decisions.shift() ?? { reply: 'ok', action: null }, tokensUsed: 120, model: 'm' };
    }),
  };
  const usage = {
    assertWithinLimit: jest.fn(async () => { if (opts.overLimit) throw new Error('Monthly AI limit reached'); }),
    record: jest.fn(async () => undefined),
  };
  const service = new WhatsappBotAgentService(
    ai as any,
    { resolveForContext: jest.fn(async () => ({ companyName: 'Chilenje Roasters' })) } as any,
    { search: jest.fn(async () => []) } as any,
    { embed: jest.fn(async () => [0.1]) } as any,
    usage as any,
  );
  const respond = () =>
    service.respond({
      tenantId: 't1', ownerId: 'u1', phone: '260971234567',
      node: { instructions: 'Help customers', builtInActions: ['save_lead', 'handoff'] },
      history: [{ role: 'customer', content: 'What coffee do you sell?' }], vars: {},
    });
  return { respond, ai, usage };
}

describe('WhatsappBotAgentService', () => {
  it('records AI usage for each reply', async () => {
    const { respond, usage } = setup({ decisions: [{ reply: 'Hello!', action: null }] });
    await respond();
    expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1', functionName: 'whatsapp-agent', tokensUsed: 120 }));
  });

  it('hands over to the team instead of answering when the plan has no AI left', async () => {
    const { respond, ai } = setup({ overLimit: true });
    const r = await respond();
    expect(r.handoff).toBe(true);
    expect(ai.completeJson).not.toHaveBeenCalled();
  });

  it('hands over to the team when the AI provider fails', async () => {
    const r = await setup({ aiError: new Error('429 rate limited') }).respond();
    expect(r.handoff).toBe(true);
    expect(r.reply).toContain('asked the team');
  });

  it("doesn't save a lead before the customer shares a name or email", async () => {
    const r = await setup({ decisions: [{ reply: 'We have fresh beans.', action: { name: 'save_lead', args: { notes: 'interested' } } }] }).respond();
    expect(r.lead).toBeUndefined();
    expect(r.reply).toBe('We have fresh beans.');
  });

  it('tells the model not to invent products when there are no documents', async () => {
    const { respond, ai } = setup();
    await respond();
    const system = (ai.completeJson.mock.calls[0] as unknown as [Array<{ content: string }>])[0][0].content;
    expect(system).toContain('Do not name or describe any specific products');
  });

  it('saves an email the customer typed even when the model forgets to', () => {
    expect(detailsShared([{ role: 'customer', content: 'My name is Jane, jane@mail.com, call me' }])).toEqual({ name: 'Jane', email: 'jane@mail.com' });
    expect(detailsShared([{ role: 'customer', content: 'What do you sell?' }])).toBeUndefined();
  });
});
