import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import type { ChatCitation } from '../entities/chat-message.entity';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);
  private embeddingMode: 'vector' | 'text' | 'none' | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /** Detect how embeddings are stored — column must exist and be vector type for pgvector ops. */
  private async getEmbeddingMode(): Promise<'vector' | 'text' | 'none'> {
    if (this.embeddingMode !== null) return this.embeddingMode;
    try {
      const rows: Array<{ udt_name: string }> = await this.dataSource.query(
        `SELECT udt_name FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'knowledge_chunks'
           AND column_name = 'embedding'`,
      );
      if (!rows.length) {
        this.embeddingMode = 'none';
        return 'none';
      }
      this.embeddingMode = rows[0].udt_name === 'vector' ? 'vector' : 'text';
    } catch {
      this.embeddingMode = 'none';
    }
    return this.embeddingMode!;
  }

  async insertChunk(params: {
    tenantId: string;
    documentId: string;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const id = randomUUID();
    const meta = params.metadata ? JSON.stringify(params.metadata) : null;

    const mode = await this.getEmbeddingMode();
    if (mode === 'vector') {
      await this.dataSource.query(
        `INSERT INTO knowledge_chunks
          (id, tenant_id, document_id, chunk_index, content, token_count, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)`,
        [
          id,
          params.tenantId,
          params.documentId,
          params.chunkIndex,
          params.content,
          params.tokenCount,
          this.toVectorLiteral(params.embedding),
          meta,
        ],
      );
    } else if (mode === 'text') {
      await this.dataSource.query(
        `INSERT INTO knowledge_chunks
          (id, tenant_id, document_id, chunk_index, content, token_count, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          params.tenantId,
          params.documentId,
          params.chunkIndex,
          params.content,
          params.tokenCount,
          JSON.stringify(params.embedding),
          meta,
        ],
      );
    } else {
      await this.dataSource.query(
        `INSERT INTO knowledge_chunks
          (id, tenant_id, document_id, chunk_index, content, token_count, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          params.tenantId,
          params.documentId,
          params.chunkIndex,
          params.content,
          params.tokenCount,
          meta,
        ],
      );
      this.logger.warn('knowledge_chunks.embedding column missing — stored chunk without vector');
    }
    return id;
  }

  async deleteByDocument(documentId: string, tenantId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM knowledge_chunks WHERE document_id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );
  }

  async search(params: {
    tenantId: string;
    embedding: number[];
    topK: number;
    minScore: number;
  }): Promise<RetrievedChunk[]> {
    const mode = await this.getEmbeddingMode();
    if (mode === 'vector') {
      return this.searchPgvector(params);
    }
    if (mode === 'text') {
      return this.searchInMemory(params);
    }
    return [];
  }

  private async searchPgvector(params: {
    tenantId: string;
    embedding: number[];
    topK: number;
    minScore: number;
  }): Promise<RetrievedChunk[]> {
    const vector = this.toVectorLiteral(params.embedding);
    try {
      const rows: Array<{
        id: string;
        document_id: string;
        title: string;
        content: string;
        score: string;
      }> = await this.dataSource.query(
        `SELECT kc.id, kc.document_id, kd.title, kc.content,
                (1 - (kc.embedding <=> $1::vector)) AS score
         FROM knowledge_chunks kc
         INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
         WHERE kc.tenant_id = $2
           AND kd.status = 'ready'
           AND kc.embedding IS NOT NULL
         ORDER BY kc.embedding <=> $1::vector
         LIMIT $3`,
        [vector, params.tenantId, params.topK],
      );

      return rows
        .map((r) => ({
          id: r.id,
          documentId: r.document_id,
          title: r.title,
          content: r.content,
          score: parseFloat(r.score),
        }))
        .filter((r) => r.score >= params.minScore);
    } catch (err) {
      this.logger.error('pgvector search failed', err);
      return this.searchInMemory(params);
    }
  }

  private async searchInMemory(params: {
    tenantId: string;
    embedding: number[];
    topK: number;
    minScore: number;
  }): Promise<RetrievedChunk[]> {
    let rows: Array<{
      id: string;
      document_id: string;
      title: string;
      content: string;
      embedding: string;
    }>;
    try {
      rows = await this.dataSource.query(
        `SELECT kc.id, kc.document_id, kd.title, kc.content, kc.embedding::text AS embedding
         FROM knowledge_chunks kc
         INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
         WHERE kc.tenant_id = $1 AND kd.status = 'ready' AND kc.embedding IS NOT NULL`,
        [params.tenantId],
      );
    } catch (err) {
      this.logger.error('In-memory vector search failed', err);
      return [];
    }

    const scored = rows
      .map((r) => {
        let vec: number[];
        try {
          vec = JSON.parse(r.embedding) as number[];
        } catch {
          return null;
        }
        const score = cosineSimilarity(params.embedding, vec);
        return {
          id: r.id,
          documentId: r.document_id,
          title: r.title,
          content: r.content,
          score,
        };
      })
      .filter((r): r is RetrievedChunk => r != null && r.score >= params.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK);

    return scored;
  }

  toCitations(chunks: RetrievedChunk[]): ChatCitation[] {
    return chunks.map((c) => ({
      documentId: c.documentId,
      chunkId: c.id,
      title: c.title,
      excerpt: c.content.slice(0, 200) + (c.content.length > 200 ? '…' : ''),
    }));
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
