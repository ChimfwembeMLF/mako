jest.mock('./qdrant.service', () => ({ QdrantService: class {} }));
jest.mock('./knowledge-embedding.service', () => ({ KnowledgeEmbeddingService: class {} }));

import { VectorStoreService } from './vector-store.service';

function setup(hits: Array<{ id: string; score: number }>, rows: Array<Record<string, string>>) {
  const dataSource = { query: jest.fn(async (..._args: unknown[]) => rows as unknown[]) };
  const qdrant = {
    isConfigured: jest.fn(async () => true),
    search: jest.fn(async () => hits),
    upsert: jest.fn(async () => undefined),
    deleteDocument: jest.fn(async () => undefined),
  };
  const embeddings = { collection: jest.fn(async () => 'mako_knowledge_text_embedding_3_small') };
  const store = new VectorStoreService(dataSource as any, qdrant as any, embeddings as any);
  return { store, dataSource, qdrant };
}

describe('VectorStoreService with Qdrant', () => {
  it('searches within the tenant and returns chunks in Qdrant score order', async () => {
    const { store, qdrant, dataSource } = setup(
      [{ id: 'c2', score: 0.9 }, { id: 'c1', score: 0.7 }],
      [
        { id: 'c1', document_id: 'd1', title: 'Menu', content: 'Cold brew' },
        { id: 'c2', document_id: 'd1', title: 'Menu', content: 'Espresso' },
      ],
    );
    const result = await store.search({ tenantId: 't1', embedding: [0.1, 0.2], topK: 5, minScore: 0.5 });

    expect(qdrant.search).toHaveBeenCalledWith('mako_knowledge_text_embedding_3_small', expect.objectContaining({ tenantId: 't1' }));
    expect(dataSource.query.mock.calls[0][1]).toEqual([['c2', 'c1'], 't1']);
    expect(result.map((r) => [r.id, r.score])).toEqual([['c2', 0.9], ['c1', 0.7]]);
  });

  it('drops hits whose chunk is gone or belongs to another tenant', async () => {
    const { store } = setup([{ id: 'other-tenant-chunk', score: 0.95 }], []);
    expect(await store.search({ tenantId: 't1', embedding: [0.1], topK: 5, minScore: 0 })).toEqual([]);
  });

  it('stores the vector in Qdrant and only the text in Postgres', async () => {
    const { store, qdrant, dataSource } = setup([], []);
    const id = await store.insertChunk({ tenantId: 't1', documentId: 'd1', chunkIndex: 0, content: 'Hi', tokenCount: 1, embedding: [0.3, 0.4] });

    expect(dataSource.query.mock.calls[0][0]).not.toContain('embedding');
    expect(qdrant.upsert).toHaveBeenCalledWith('mako_knowledge_text_embedding_3_small', [
      { id, vector: [0.3, 0.4], payload: { tenant_id: 't1', document_id: 'd1', chunk_index: 0 } },
    ]);
  });

  it('falls back to Postgres when Qdrant search fails', async () => {
    const { store, qdrant, dataSource } = setup([], []);
    qdrant.search.mockRejectedValueOnce(new Error('down'));
    dataSource.query.mockResolvedValueOnce([{ udt_name: 'text' }]).mockResolvedValueOnce([]);
    await expect(store.search({ tenantId: 't1', embedding: [0.1], topK: 5, minScore: 0 })).resolves.toEqual([]);
  });
});
