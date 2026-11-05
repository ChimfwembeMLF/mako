import { Injectable } from '@nestjs/common';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';
import { OpenAIChatService } from '../../ai/services/openai-chat.service';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { GeminiChatService } from '../../ai/services/gemini-chat.service';

type EmbedProvider = 'openai' | 'mistral' | 'gemini';

/**
 * One embedding model for every workspace's knowledge base. Document vectors and
 * question vectors must come from the same model, so this deliberately ignores each
 * workspace's preferred chat provider.
 */
@Injectable()
export class KnowledgeEmbeddingService {
  constructor(
    private readonly integrations: PlatformIntegrationsService,
    private readonly openai: OpenAIChatService,
    private readonly mistral: MistralChatService,
    private readonly gemini: GeminiChatService,
  ) {}

  /** KNOWLEDGE_EMBED_PROVIDER if set, otherwise OpenAI when a platform key exists, else Mistral. */
  async provider(): Promise<EmbedProvider> {
    const chosen = (await this.integrations.getIntegrationWithEnvFallback('KNOWLEDGE_EMBED_PROVIDER'))?.trim().toLowerCase();
    if (chosen === 'openai' || chosen === 'mistral' || chosen === 'gemini') return chosen;
    const openAiKey = await this.integrations.getIntegrationWithEnvFallback('OPENAI_API_KEY');
    return openAiKey?.trim() ? 'openai' : 'mistral';
  }

  async model(): Promise<string> {
    const p = await this.provider();
    if (p === 'openai') return this.openai.embedModel;
    if (p === 'gemini') return this.gemini.embedModel;
    return this.mistral.embedModel;
  }

  /** Qdrant collection for the current model; a new model gets a new collection, so vectors never mix. */
  async collection(): Promise<string> {
    const slug = (await this.model()).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `mako_knowledge_${slug}`;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const p = await this.provider();
    // Platform key only (no tenant id): every workspace's vectors must share one model.
    if (p === 'openai') return this.openai.embedBatch(texts);
    if (p === 'gemini') return this.gemini.embedBatch(texts);
    return this.mistral.embedBatch(texts);
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }
}
