jest.mock('../../ai/services/openai-chat.service', () => ({ OpenAIChatService: class {} }));
jest.mock('../../ai/services/mistral-chat.service', () => ({ MistralChatService: class {} }));
jest.mock('../../ai/services/gemini-chat.service', () => ({ GeminiChatService: class {} }));

import { KnowledgeEmbeddingService } from './knowledge-embedding.service';

function setup(settings: Record<string, string>) {
  const integrations = { getIntegrationWithEnvFallback: jest.fn(async (k: string) => settings[k]) };
  const openai = { embedModel: 'text-embedding-3-small', embedBatch: jest.fn(async (t: string[]) => t.map(() => [1])) };
  const mistral = { embedModel: 'mistral-embed', embedBatch: jest.fn(async (t: string[]) => t.map(() => [2])) };
  const gemini = { embedModel: 'text-embedding-004', embedBatch: jest.fn(async (t: string[]) => t.map(() => [3])) };
  return { service: new KnowledgeEmbeddingService(integrations as any, openai as any, mistral as any, gemini as any), openai, mistral };
}

describe('KnowledgeEmbeddingService', () => {
  const realFetch = global.fetch;
  let calls: Array<{ url: string; body: { model: string; input: string[] }; headers: Record<string, string> }>;

  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body, headers: init.headers });
      const data = body.input.map((_: string, i: number) => ({ index: i, embedding: [0.1 * (i + 1), 0.2] })).reverse();
      return { ok: true, text: async () => JSON.stringify({ data }) } as Response;
    }) as unknown as typeof fetch;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('uses a self-hosted server (e.g. TEI) when EMBEDDINGS_URL is set', async () => {
    const { service, openai } = setup({ EMBEDDINGS_URL: 'http://mako-embeddings/', OPENAI_API_KEY: 'sk' });
    expect(await service.provider()).toBe('self_hosted');
    expect(await service.model()).toBe('intfloat/multilingual-e5-small');
    expect(await service.collection()).toBe('mako_knowledge_intfloat_multilingual_e5_small');

    const vectors = await service.embedBatch(['first', 'second']);
    expect(calls[0].url).toBe('http://mako-embeddings/v1/embeddings');
    // Returned out of order on purpose: results are put back in input order.
    expect(vectors).toEqual([[0.1, 0.2], [0.2, 0.2]]);
    expect(openai.embedBatch).not.toHaveBeenCalled();
  });

  it('adds the e5 passage and query prefixes', async () => {
    const { service } = setup({ EMBEDDINGS_URL: 'http://tei' });
    await service.embedBatch(['Opening hours are 8 to 5']);
    await service.embed('when are you open?');
    expect(calls[0].body.input).toEqual(['passage: Opening hours are 8 to 5']);
    expect(calls[1].body.input).toEqual(['query: when are you open?']);
  });

  it('keeps the e5 prefixes when the prefix settings are present but empty', async () => {
    const { service } = setup({ EMBEDDINGS_URL: 'http://tei', EMBEDDINGS_QUERY_PREFIX: '', EMBEDDINGS_DOCUMENT_PREFIX: '' });
    await service.embed('hi');
    expect(calls[0].body.input).toEqual(['query: hi']);
  });

  it('adds no prefixes for other models unless configured', async () => {
    const plain = setup({ EMBEDDINGS_URL: 'http://tei', EMBEDDINGS_MODEL: 'BAAI/bge-small-en-v1.5' });
    await plain.service.embed('hi');
    expect(calls[0].body.input).toEqual(['hi']);

    const custom = setup({ EMBEDDINGS_URL: 'http://tei', EMBEDDINGS_MODEL: 'nomic-embed-text', EMBEDDINGS_QUERY_PREFIX: 'search_query: ' });
    await custom.service.embed('hi');
    expect(calls[1].body.input).toEqual(['search_query: hi']);
  });

  it('sends the API key when one is set', async () => {
    const { service } = setup({ EMBEDDINGS_URL: 'http://tei', EMBEDDINGS_API_KEY: 'secret' });
    await service.embed('hi');
    expect(calls[0].headers.Authorization).toBe('Bearer secret');
  });

  it('falls back to OpenAI, then Mistral, without a self-hosted server', async () => {
    expect(await setup({ OPENAI_API_KEY: 'sk' }).service.provider()).toBe('openai');
    expect(await setup({}).service.provider()).toBe('mistral');
    expect(await setup({ EMBEDDINGS_URL: 'http://tei', KNOWLEDGE_EMBED_PROVIDER: 'openai', OPENAI_API_KEY: 'sk' }).service.provider()).toBe('openai');
  });

  it('reports an unreachable embedding server in the health check', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, text: async () => 'loading model' })) as unknown as typeof fetch;
    const { service } = setup({ EMBEDDINGS_URL: 'http://tei' });
    expect(await service.check()).toEqual({ ok: false, error: 'Embedding server replied 503: loading model' });
  });
});
