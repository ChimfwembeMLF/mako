import { Injectable } from '@nestjs/common';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';
import { OpenAIChatService } from '../../ai/services/openai-chat.service';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { GeminiChatService } from '../../ai/services/gemini-chat.service';

export type EmbedProvider = 'openai' | 'mistral' | 'gemini' | 'self_hosted';

const PROVIDERS: EmbedProvider[] = ['openai', 'mistral', 'gemini', 'self_hosted'];
const DEFAULT_SELF_HOSTED_MODEL = 'intfloat/multilingual-e5-small';

/**
 * One embedding model for every workspace's knowledge base. Document vectors and
 * question vectors must come from the same model, so this deliberately ignores each
 * workspace's preferred chat provider.
 *
 * "self_hosted" is any server with an OpenAI-style /v1/embeddings endpoint, such as
 * Hugging Face Text Embeddings Inference (TEI), Ollama or Infinity.
 */
@Injectable()
export class KnowledgeEmbeddingService {
  constructor(
    private readonly integrations: PlatformIntegrationsService,
    private readonly openai: OpenAIChatService,
    private readonly mistral: MistralChatService,
    private readonly gemini: GeminiChatService,
  ) {}

  private setting(key: string) {
    return this.integrations.getIntegrationWithEnvFallback(key).then((v) => v?.trim() || undefined);
  }

  /**
   * KNOWLEDGE_EMBED_PROVIDER if set; otherwise self-hosted when EMBEDDINGS_URL is set,
   * then OpenAI when it has a platform key, else Mistral.
   */
  async provider(): Promise<EmbedProvider> {
    const chosen = (await this.setting('KNOWLEDGE_EMBED_PROVIDER'))?.toLowerCase() as EmbedProvider | undefined;
    if (chosen && PROVIDERS.includes(chosen)) return chosen;
    if (await this.setting('EMBEDDINGS_URL')) return 'self_hosted';
    return (await this.setting('OPENAI_API_KEY')) ? 'openai' : 'mistral';
  }

  async model(): Promise<string> {
    const p = await this.provider();
    if (p === 'self_hosted') return (await this.setting('EMBEDDINGS_MODEL')) ?? DEFAULT_SELF_HOSTED_MODEL;
    if (p === 'openai') return this.openai.embedModel;
    if (p === 'gemini') return this.gemini.embedModel;
    return this.mistral.embedModel;
  }

  /** Qdrant collection for the current model; a new model gets a new collection, so vectors never mix. */
  async collection(): Promise<string> {
    const slug = (await this.model()).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `mako_knowledge_${slug}`;
  }

  /** Document chunks being indexed. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const p = await this.provider();
    // Platform key only (no tenant id): every workspace's vectors must share one model.
    if (p === 'self_hosted') return this.selfHosted(texts, 'document');
    if (p === 'openai') return this.openai.embedBatch(texts);
    if (p === 'gemini') return this.gemini.embedBatch(texts);
    return this.mistral.embedBatch(texts);
  }

  /** A customer's question, searched against indexed documents. */
  async embed(text: string): Promise<number[]> {
    const p = await this.provider();
    const [vector] = p === 'self_hosted' ? await this.selfHosted([text], 'query') : await this.embedBatch([text]);
    return vector;
  }

  /**
   * e5 models are trained with "query: " / "passage: " prefixes and lose accuracy without
   * them. Other models get none unless EMBEDDINGS_QUERY_PREFIX / EMBEDDINGS_DOCUMENT_PREFIX are set.
   */
  async prefixes(): Promise<{ query: string; document: string }> {
    const model = (await this.model()).toLowerCase();
    const e5 = /(^|[/-])e5[-_]/.test(model) || model.includes('/e5');
    const query = await this.integrations.getIntegrationWithEnvFallback('EMBEDDINGS_QUERY_PREFIX');
    const document = await this.integrations.getIntegrationWithEnvFallback('EMBEDDINGS_DOCUMENT_PREFIX');
    // An empty setting (e.g. copied from .env.example) means "not set", not "no prefix".
    return {
      query: query || (e5 ? 'query: ' : ''),
      document: document || (e5 ? 'passage: ' : ''),
    };
  }

  private async selfHosted(texts: string[], kind: 'query' | 'document'): Promise<number[][]> {
    const base = await this.setting('EMBEDDINGS_URL');
    if (!base) throw new Error('EMBEDDINGS_URL is not set for self-hosted embeddings');
    const apiKey = await this.setting('EMBEDDINGS_API_KEY');
    const model = await this.model();
    const prefix = (await this.prefixes())[kind];

    const res = await fetch(`${base.replace(/\/+$/, '')}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, input: texts.map((t) => `${prefix}${t}`) }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Embedding server replied ${res.status}: ${body.slice(0, 200)}`);
    const data = (JSON.parse(body) as { data?: Array<{ index?: number; embedding: number[] }> }).data ?? [];
    if (data.length !== texts.length) throw new Error(`Embedding server returned ${data.length} vectors for ${texts.length} texts`);
    return [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((d) => d.embedding);
  }

  /** Embeds a short text to prove the model is reachable; used by the Backoffice health check. */
  async check(): Promise<{ ok: boolean; dimensions?: number; error?: string }> {
    try {
      const vector = await this.embed('health check');
      return { ok: Array.isArray(vector) && vector.length > 0, dimensions: vector?.length };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
