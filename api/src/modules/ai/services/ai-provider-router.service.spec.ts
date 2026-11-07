// The real provider clients pull in ESM-only SDKs; the router only needs their shape.
jest.mock('./mistral-chat.service', () => ({ MistralChatService: class {} }));
jest.mock('./openai-chat.service', () => ({ OpenAIChatService: class {} }));
jest.mock('./gemini-chat.service', () => ({ GeminiChatService: class {} }));
jest.mock('./deepseek-chat.service', () => ({ DeepseekChatService: class {} }));
jest.mock('./parler-tts.service', () => ({ ParlerTtsService: class {} }));

import { AiProviderRouter } from './ai-provider-router.service';

function provider(name: string, defaults: { defaultModel: string; premiumModel: string }) {
  return {
    ...defaults,
    complete: jest.fn(async (_m: unknown, opts: { model?: string }) => ({ content: name, tokensUsed: 1, model: opts?.model ?? defaults.defaultModel })),
    speak: jest.fn(async () => ({ audioData: name, format: 'mp3' })),
  };
}

function setup(opts: { preferred?: string | null; voice?: string | null; keys?: Record<string, string> } = {}) {
  const mistral = provider('mistral', { defaultModel: 'mistral-small-latest', premiumModel: 'mistral-large-latest' });
  const openai = provider('openai', { defaultModel: 'gpt-4o-mini', premiumModel: 'gpt-4o' });
  const gemini = provider('gemini', { defaultModel: 'gemini-flash', premiumModel: 'gemini-pro' });
  const deepseek = provider('deepseek', { defaultModel: 'deepseek-chat', premiumModel: 'deepseek-reasoner' });
  const parler = { speak: jest.fn(async () => ({ audioData: 'parler', format: 'mp3' })) };
  const tenants = { findOne: jest.fn(async () => ({ preferredAiProvider: opts.preferred ?? null, preferredTtsProvider: opts.voice ?? null })) };
  const keys = opts.keys ?? { OPENAI_API_KEY: 'sk-test', MISTRAL_API_KEY: 'm' };
  const integrations = { getIntegrationWithEnvFallback: jest.fn(async (k: string) => keys[k]) };
  const router = new AiProviderRouter(
    mistral as any, openai as any, gemini as any, deepseek as any, parler as any, tenants as any, integrations as any,
  );
  return { router, mistral, openai, gemini, deepseek, parler };
}

const msgs = [{ role: 'user' as const, content: 'hi' }];

describe('AiProviderRouter', () => {
  it('uses OpenAI by default when a workspace has not chosen a provider', async () => {
    const { router, openai } = setup();
    const result = await router.complete(msgs, { tenantId: 't1' });
    expect(result.content).toBe('openai');
    expect(openai.complete).toHaveBeenCalled();
  });

  it('falls back to Mistral when there is no OpenAI platform key', async () => {
    const { router } = setup({ keys: { MISTRAL_API_KEY: 'm' } });
    expect((await router.complete(msgs, { tenantId: 't1' })).content).toBe('mistral');
  });

  it('honours AI_DEFAULT_PROVIDER when its key is set', async () => {
    const { router } = setup({ keys: { AI_DEFAULT_PROVIDER: 'gemini', GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' } });
    expect((await router.complete(msgs, { tenantId: 't1' })).content).toBe('gemini');
  });

  it("uses the workspace's own chat provider over the default", async () => {
    const { router } = setup({ preferred: 'deepseek' });
    expect((await router.complete(msgs, { tenantId: 't1' })).content).toBe('deepseek');
  });

  it('never uses a voice-only provider for chat', async () => {
    const { router } = setup({ preferred: 'self_hosted_parler' });
    expect((await router.complete(msgs, { tenantId: 't1' })).content).toBe('openai');
  });

  it('keeps the chat provider and the voice separate', async () => {
    const { router, parler, gemini } = setup({ preferred: 'gemini', voice: 'self_hosted_parler', keys: { GEMINI_API_KEY: 'g' } });
    expect((await router.complete(msgs, { tenantId: 't1' })).content).toBe('gemini');
    await router.speak('hello', { tenantId: 't1' });
    expect(parler.speak).toHaveBeenCalled();
    expect(gemini.speak).not.toHaveBeenCalled();
  });

  it("uses the chat provider's own voice when no voice is chosen", async () => {
    const { router, openai } = setup({ preferred: 'openai' });
    await router.speak('hello', { tenantId: 't1' });
    expect(openai.speak).toHaveBeenCalled();
  });

  it("translates a chatbot's saved Mistral model for other providers", async () => {
    const { router, openai } = setup();
    await router.complete(msgs, { tenantId: 't1', model: 'mistral-small-latest' });
    await router.complete(msgs, { tenantId: 't1', model: 'mistral-large-latest' });
    expect(openai.complete.mock.calls.map((c) => (c[1] as { model: string }).model)).toEqual(['gpt-4o-mini', 'gpt-4o']);
  });
});
