import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mistral } from '@mistralai/mistralai';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { brandContextBlock } from '../../ai/prompts/brand-fields';
import { resolveSystemPromptExtra } from '../constants/default-system-message';
import { SupabaseStorageService } from '../../media/supabase-storage.service';
import { ChatbotConfig } from '../entities/chatbot-config.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';

const MISTRAL_DOC_META_KEY = 'mistralDocumentId';
const MISTRAL_SYNC_ERROR_KEY = 'mistralSyncError';
const MISTRAL_SYNCED_AT_KEY = 'mistralSyncedAt';

@Injectable()
export class MistralChatbotLibraryService {
  private readonly logger = new Logger(MistralChatbotLibraryService.name);
  private client: Mistral | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prompts: PromptBuilderService,
    private readonly brandProfiles: BrandProfilesService,
    @InjectRepository(ChatbotConfig)
    private readonly configRepo: Repository<ChatbotConfig>,
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    private readonly storage: SupabaseStorageService,
  ) {}

  isEnabled(config: ChatbotConfig): boolean {
    return Boolean(config.useMistralLibrary && config.mistralAgentId?.trim());
  }

  private getClient(): Mistral {
    const apiKey = this.config.get<string>('MISTRAL_API_KEY');
    if (!apiKey?.trim()) {
      throw new ServiceUnavailableException('MISTRAL_API_KEY is not configured');
    }
    if (!this.client) {
      this.client = new Mistral({ apiKey: apiKey.trim() });
    }
    return this.client;
  }

  async provisionForTenant(tenantId: string): Promise<ChatbotConfig> {
    const config = await this.configRepo.findOne({ where: { tenantId } });
    if (!config) {
      throw new ServiceUnavailableException('Chatbot config not found');
    }
    return this.provision(config);
  }

  async provision(config: ChatbotConfig): Promise<ChatbotConfig> {
    if (!config.useMistralLibrary) return config;

    const client = this.getClient();
    let libraryId = config.mistralLibraryId?.trim();

    if (!libraryId) {
      const library = await client.beta.libraries.create({
        name: `Mako Co-pilot · ${config.name} (${config.tenantId.slice(0, 8)})`,
        description: `Knowledge library for tenant ${config.tenantId}`,
      });
      libraryId = library.id;
      config.mistralLibraryId = libraryId;
      config = await this.configRepo.save(config);
      this.logger.log(`Created Mistral library ${libraryId} for tenant ${config.tenantId}`);
    }

    const instructions = await this.buildAgentInstructions(config);
    const agentPayload = {
      model: config.model || this.config.get('MISTRAL_DEFAULT_MODEL') || 'mistral-small-latest',
      name: config.name || 'Website Assistant',
      description: `Mako Co-pilot chatbot agent for tenant ${config.tenantId}`,
      instructions,
      tools: [{ type: 'document_library' as const, libraryIds: [libraryId] }],
      completionArgs: {
        temperature: config.temperature ?? 0.3,
      },
    };

    if (config.mistralAgentId?.trim()) {
      await client.beta.agents.update({
        agentId: config.mistralAgentId,
        updateAgentRequest: agentPayload,
      });
      this.logger.log(`Updated Mistral agent ${config.mistralAgentId}`);
    } else {
      const agent = await client.beta.agents.create(agentPayload);
      config.mistralAgentId = agent.id;
      config = await this.configRepo.save(config);
      this.logger.log(`Created Mistral agent ${agent.id} for tenant ${config.tenantId}`);
    }

    return config;
  }

  async syncAgentInstructions(config: ChatbotConfig): Promise<void> {
    if (!config.useMistralLibrary || !config.mistralAgentId?.trim()) return;
    const client = this.getClient();
    const instructions = await this.buildAgentInstructions(config);
    await client.beta.agents.update({
      agentId: config.mistralAgentId,
      updateAgentRequest: { instructions },
    });
  }

  async uploadDocument(params: {
    config: ChatbotConfig;
    doc: KnowledgeDocument;
    buffer: Buffer;
    fileName: string;
    mimeType?: string;
  }): Promise<KnowledgeDocument> {
    if (!params.config.useMistralLibrary) return params.doc;

    const config = await this.provision(params.config);
    const client = this.getClient();
    const libraryId = config.mistralLibraryId;
    if (!libraryId) return params.doc;

    const existingId = this.getMistralDocumentId(params.doc);
    if (existingId) {
      try {
        await client.beta.libraries.documents.delete({
          libraryId,
          documentId: existingId,
        });
      } catch {
        /* replaced on re-upload */
      }
    }

    const uploaded = await client.beta.libraries.documents.upload({
      libraryId,
      requestBody: {
        file: {
          fileName: params.fileName,
          content: params.buffer,
        },
      },
    });

    this.logger.log(
      `Uploaded ${params.fileName} → Mistral library ${libraryId} (doc ${uploaded.id})`,
    );

    params.doc.metadata = {
      ...(params.doc.metadata ?? {}),
      [MISTRAL_DOC_META_KEY]: uploaded.id,
      [MISTRAL_SYNCED_AT_KEY]: new Date().toISOString(),
      [MISTRAL_SYNC_ERROR_KEY]: null,
    };
    return this.docRepo.save(params.doc);
  }

  async deleteDocument(config: ChatbotConfig, doc: KnowledgeDocument): Promise<void> {
    const mistralDocId = this.getMistralDocumentId(doc);
    const libraryId = config.mistralLibraryId?.trim();
    if (!config.useMistralLibrary || !libraryId || !mistralDocId) return;

    try {
      const client = this.getClient();
      await client.beta.libraries.documents.delete({
        libraryId,
        documentId: mistralDocId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Mistral document delete failed (${mistralDocId}): ${message}`);
    }
  }

  async syncUnsyncedDocuments(tenantId: string, config: ChatbotConfig): Promise<void> {
    if (!config.useMistralLibrary) return;
    const provisioned = await this.provision(config);
    const docs = await this.docRepo.find({
      where: { tenantId },
      order: { created_at: 'ASC' },
    });

    for (const doc of docs) {
      if (!doc.storageUrl || this.getMistralDocumentId(doc)) continue;
      try {
        const buffer = await this.storage.downloadBuffer(doc.storageUrl);
        await this.uploadDocument({
          config: provisioned,
          doc,
          buffer,
          fileName: doc.title,
          mimeType: doc.mimeType,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Mistral sync failed for doc ${doc.id}: ${message}`);
        doc.metadata = {
          ...(doc.metadata ?? {}),
          [MISTRAL_SYNC_ERROR_KEY]: message,
        };
        await this.docRepo.save(doc);
      }
    }
  }

  async recordSyncError(doc: KnowledgeDocument, message: string): Promise<void> {
    doc.metadata = {
      ...(doc.metadata ?? {}),
      [MISTRAL_SYNC_ERROR_KEY]: message,
    };
    await this.docRepo.save(doc);
  }

  async chat(params: {
    config: ChatbotConfig;
    userMessage: string;
    mistralConversationId?: string;
  }): Promise<{
    content: string;
    conversationId: string;
    model: string;
    tokensUsed: number;
  }> {
    const agentId = params.config.mistralAgentId?.trim();
    if (!agentId) {
      throw new ServiceUnavailableException('Mistral agent is not provisioned');
    }

    const client = this.getClient();
    const conversationId = params.mistralConversationId?.trim();

    const response = conversationId
      ? await client.beta.conversations.append({
          conversationId,
          conversationAppendRequest: {
            inputs: params.userMessage,
            store: true,
          },
        })
      : await client.beta.conversations.start({
          agentId,
          inputs: params.userMessage,
          store: true,
        });

    const content = this.extractAssistantText(response.outputs ?? []);
    const usage = response.usage as { totalTokens?: number; promptTokens?: number; completionTokens?: number };
    const tokensUsed =
      usage?.totalTokens ??
      (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0);

    return {
      content: content || "I couldn't generate a response. Please try again.",
      conversationId: response.conversationId,
      model: params.config.model,
      tokensUsed,
    };
  }

  getMistralDocumentId(doc: KnowledgeDocument): string | undefined {
    const id = doc.metadata?.[MISTRAL_DOC_META_KEY];
    return typeof id === 'string' && id.trim() ? id.trim() : undefined;
  }

  private extractAssistantText(outputs: unknown[]): string {
    const parts: string[] = [];
    for (const output of outputs) {
      const entry = output as {
        type?: string;
        role?: string;
        content?: string | Array<{ type?: string; text?: string }>;
      };
      if (entry.type !== 'message.output' && entry.role !== 'assistant') continue;
      if (typeof entry.content === 'string') {
        parts.push(entry.content);
      } else if (Array.isArray(entry.content)) {
        for (const chunk of entry.content) {
          const c = chunk as { type?: string; text?: string };
          if (c.type === 'text' && c.text) parts.push(c.text);
        }
      }
    }
    return parts.join('\n').trim();
  }

  private async buildAgentInstructions(config: ChatbotConfig): Promise<string> {
    const brand = await this.resolveBrand(config.tenantId, config.brandProfileId);
    const guardrails = [
      brand.bannedWords ? `Never use these words: ${brand.bannedWords}` : '',
      brand.bannedTopics ? `Avoid these topics: ${brand.bannedTopics}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const parts = [
      `You are ${config.name}, a helpful assistant for ${brand.companyName || 'this business'}.`,
      'Use the document library tool to answer questions from uploaded tenant documents.',
      'Ground answers in retrieved documents when relevant. If you do not know something, say so.',
      guardrails,
      resolveSystemPromptExtra(config.systemPromptExtra),
      `Brand profile:\n${brandContextBlock(brand)}`,
    ];
    return parts.filter(Boolean).join('\n\n');
  }

  private async resolveBrand(tenantId: string, brandProfileId?: string) {
    if (brandProfileId) {
      const profile = await this.brandProfiles.findOne(brandProfileId);
      if (profile.tenantId !== tenantId) return {};
      return this.prompts.brandFromEntity(profile);
    }
    const profiles = await this.brandProfiles.findForTenant(tenantId);
    return this.prompts.brandFromEntity(profiles[0] ?? null);
  }

}
