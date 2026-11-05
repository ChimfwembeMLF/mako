import { Injectable, Logger } from '@nestjs/common';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';

export type QdrantPoint = {
  id: string;
  vector: number[];
  payload: { tenant_id: string; document_id: string; chunk_index: number };
};

export type QdrantHit = { id: string; score: number };

/**
 * Minimal Qdrant REST client for the chatbot knowledge base.
 * Reads QDRANT_URL / QDRANT_API_KEY from Backoffice → Integrations, falling back to the environment.
 */
@Injectable()
export class QdrantService {
  private readonly logger = new Logger(QdrantService.name);
  private readonly ensured = new Set<string>();

  constructor(private readonly integrations: PlatformIntegrationsService) {}

  private async settings(): Promise<{ url: string; apiKey?: string } | null> {
    const url = (await this.integrations.getIntegrationWithEnvFallback('QDRANT_URL'))?.trim();
    if (!url) return null;
    const apiKey = (await this.integrations.getIntegrationWithEnvFallback('QDRANT_API_KEY'))?.trim();
    return { url: url.replace(/\/+$/, ''), apiKey: apiKey || undefined };
  }

  async isConfigured(): Promise<boolean> {
    return (await this.settings()) !== null;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const s = await this.settings();
    if (!s) throw new Error('Qdrant is not configured (QDRANT_URL)');
    const res = await fetch(`${s.url}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(s.apiKey ? { 'api-key': s.apiKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Qdrant ${method} ${path} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** Creates the collection (cosine distance) and its tenant/document filter indexes if missing. */
  async ensureCollection(name: string, size: number): Promise<void> {
    if (this.ensured.has(name)) return;
    const exists = await this.request<{ result?: { exists?: boolean } }>('GET', `/collections/${name}/exists`);
    if (!exists.result?.exists) {
      await this.request('PUT', `/collections/${name}`, { vectors: { size, distance: 'Cosine' } });
      for (const field of ['tenant_id', 'document_id']) {
        await this.request('PUT', `/collections/${name}/index?wait=true`, { field_name: field, field_schema: 'keyword' });
      }
      this.logger.log(`Created Qdrant collection ${name} (${size} dimensions)`);
    }
    this.ensured.add(name);
  }

  async upsert(collection: string, points: QdrantPoint[]): Promise<void> {
    if (!points.length) return;
    await this.ensureCollection(collection, points[0].vector.length);
    await this.request('PUT', `/collections/${collection}/points?wait=true`, { points });
  }

  /** Nearest chunks within one tenant only — the tenant filter is what keeps workspaces apart. */
  async search(collection: string, params: { vector: number[]; tenantId: string; limit: number; minScore: number }): Promise<QdrantHit[]> {
    const exists = await this.request<{ result?: { exists?: boolean } }>('GET', `/collections/${collection}/exists`);
    if (!exists.result?.exists) return [];
    const res = await this.request<{ result: Array<{ id: string; score: number }> }>(
      'POST',
      `/collections/${collection}/points/search`,
      {
        vector: params.vector,
        limit: params.limit,
        score_threshold: params.minScore,
        filter: { must: [{ key: 'tenant_id', match: { value: params.tenantId } }] },
      },
    );
    return res.result.map((r) => ({ id: String(r.id), score: r.score }));
  }

  async deleteDocument(collection: string, documentId: string, tenantId: string): Promise<void> {
    const exists = await this.request<{ result?: { exists?: boolean } }>('GET', `/collections/${collection}/exists`);
    if (!exists.result?.exists) return;
    await this.request('POST', `/collections/${collection}/points/delete?wait=true`, {
      filter: {
        must: [
          { key: 'document_id', match: { value: documentId } },
          { key: 'tenant_id', match: { value: tenantId } },
        ],
      },
    });
  }

  /** Reachability and point count, for the Backoffice health view. */
  async status(collection: string): Promise<{ reachable: boolean; points: number; error?: string }> {
    try {
      const exists = await this.request<{ result?: { exists?: boolean } }>('GET', `/collections/${collection}/exists`);
      if (!exists.result?.exists) return { reachable: true, points: 0 };
      const info = await this.request<{ result?: { points_count?: number } }>('GET', `/collections/${collection}`);
      return { reachable: true, points: info.result?.points_count ?? 0 };
    } catch (err) {
      return { reachable: false, points: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
