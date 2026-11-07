import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MistralChatService, ChatMessage, ChatResult } from './mistral-chat.service';
import { OpenAIChatService } from './openai-chat.service';
import { GeminiChatService } from './gemini-chat.service';
import { DeepseekChatService } from './deepseek-chat.service';
import { ParlerTtsService } from './parler-tts.service';
export { ChatMessage, ChatResult };
import { Tenants } from '../../tenants/entities/tenants.entity';
import { IntegrationProvider } from '../../tenants/entities/tenant-integration-config.entity';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';

/** Providers that can answer chat requests. Others (e.g. self-hosted voice) are text-to-speech only. */
const CHAT_PROVIDERS = new Set<IntegrationProvider>([
  IntegrationProvider.MISTRAL,
  IntegrationProvider.OPENAI,
  IntegrationProvider.GEMINI,
  IntegrationProvider.DEEPSEEK,
]);

const PLATFORM_KEY: Partial<Record<IntegrationProvider, string>> = {
  [IntegrationProvider.MISTRAL]: 'MISTRAL_API_KEY',
  [IntegrationProvider.OPENAI]: 'OPENAI_API_KEY',
  [IntegrationProvider.GEMINI]: 'GEMINI_API_KEY',
  [IntegrationProvider.DEEPSEEK]: 'DEEPSEEK_API_KEY',
};

const MISTRAL_MODEL = /^(mistral|ministral|open-mistral|open-mixtral|pixtral|codestral|magistral)/i;

@Injectable()
export class AiProviderRouter {
  private readonly logger = new Logger(AiProviderRouter.name);

  constructor(
    private readonly mistralService: MistralChatService,
    private readonly openAiService: OpenAIChatService,
    private readonly geminiService: GeminiChatService,
    private readonly deepseekService: DeepseekChatService,
    private readonly parlerTtsService: ParlerTtsService,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    private readonly integrations: PlatformIntegrationsService,
  ) {}

  get defaultModel(): string {
    return this.mistralService.defaultModel;
  }

  get premiumModel(): string {
    return this.mistralService.premiumModel;
  }

  /** The workspace's chosen chat and voice providers. */
  private async getTenantPreferences(tenantId?: string): Promise<{ chat: IntegrationProvider | null; voice: IntegrationProvider | null }> {
    if (!tenantId) return { chat: null, voice: null };
    try {
      const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
      return { chat: tenant?.preferredAiProvider ?? null, voice: tenant?.preferredTtsProvider ?? null };
    } catch (err) {
      this.logger.warn(`Failed to fetch preferred AI provider for tenant ${tenantId}`, err);
      return { chat: null, voice: null };
    }
  }

  /**
   * AI_DEFAULT_PROVIDER (Integrations or environment), defaulting to OpenAI.
   * Falls back to Mistral when the chosen provider has no platform key.
   */
  async getPlatformDefault(): Promise<IntegrationProvider> {
    const raw = (await this.integrations.getIntegrationWithEnvFallback('AI_DEFAULT_PROVIDER'))?.trim().toLowerCase();
    const chosen = (raw && CHAT_PROVIDERS.has(raw as IntegrationProvider) ? raw : IntegrationProvider.OPENAI) as IntegrationProvider;
    const keyName = PLATFORM_KEY[chosen];
    const key = keyName ? await this.integrations.getIntegrationWithEnvFallback(keyName) : undefined;
    return key?.trim() ? chosen : IntegrationProvider.MISTRAL;
  }

  /** Chat provider: the workspace's own choice, otherwise the platform default. */
  async getProvider(tenantId?: string): Promise<IntegrationProvider> {
    const { chat } = await this.getTenantPreferences(tenantId);
    if (chat && CHAT_PROVIDERS.has(chat)) return chat;
    return this.getPlatformDefault();
  }

  private translateModel(provider: IntegrationProvider, model?: string): string | undefined {
    if (!model) return undefined;

    // A Mistral model name (e.g. saved on a chatbot) means nothing to other providers.
    if (provider !== IntegrationProvider.MISTRAL && MISTRAL_MODEL.test(model)) {
      const premium = /large|medium/i.test(model);
      if (provider === IntegrationProvider.OPENAI) return premium ? this.openAiService.premiumModel : this.openAiService.defaultModel;
      if (provider === IntegrationProvider.GEMINI) return premium ? this.geminiService.premiumModel : this.geminiService.defaultModel;
      if (provider === IntegrationProvider.DEEPSEEK) return premium ? this.deepseekService.premiumModel : this.deepseekService.defaultModel;
    }
    
    // If the caller explicitly used the router's generic default/premium getters,
    // we translate them to the chosen provider's respective default/premium model.
    if (model === this.mistralService.defaultModel) {
      if (provider === IntegrationProvider.OPENAI) return this.openAiService.defaultModel;
      if (provider === IntegrationProvider.GEMINI) return this.geminiService.defaultModel;
      if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.defaultModel;
    }
    
    if (model === this.mistralService.premiumModel) {
      if (provider === IntegrationProvider.OPENAI) return this.openAiService.premiumModel;
      if (provider === IntegrationProvider.GEMINI) return this.geminiService.premiumModel;
      if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.premiumModel;
    }

    return model;
  }

  async complete(
    messages: ChatMessage[],
    options?: {
      model?: string;
      jsonMode?: boolean;
      maxTokens?: number;
      temperature?: number;
      tenantId?: string;
    },
  ): Promise<ChatResult> {
    const provider = await this.getProvider(options?.tenantId);
    const routedOptions = { ...options, model: this.translateModel(provider, options?.model) };

    if (provider === IntegrationProvider.OPENAI) return this.openAiService.complete(messages, routedOptions);
    if (provider === IntegrationProvider.GEMINI) return this.geminiService.complete(messages, routedOptions);
    if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.complete(messages, routedOptions);
    
    return this.mistralService.complete(messages, routedOptions);
  }

  async completeJson<T>(
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number; tenantId?: string },
  ): Promise<{ data: T; tokensUsed: number; model: string }> {
    const provider = await this.getProvider(options?.tenantId);
    const routedOptions = { ...options, model: this.translateModel(provider, options?.model) };

    if (provider === IntegrationProvider.OPENAI) return this.openAiService.completeJson<T>(messages, routedOptions);
    if (provider === IntegrationProvider.GEMINI) return this.geminiService.completeJson<T>(messages, routedOptions);
    if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.completeJson<T>(messages, routedOptions);

    return this.mistralService.completeJson<T>(messages, routedOptions);
  }

  async healthCheck(tenantId?: string): Promise<{ ok: boolean; model: string }> {
    const provider = await this.getProvider(tenantId);
    
    if (provider === IntegrationProvider.OPENAI) return this.openAiService.healthCheck(tenantId);
    if (provider === IntegrationProvider.GEMINI) return this.geminiService.healthCheck(tenantId);
    if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.healthCheck(tenantId);

    return this.mistralService.healthCheck(tenantId);
  }

  async speak(
    text: string,
    options?: { voiceId?: string | null; model?: string; tenantId?: string; description?: string | null },
  ): Promise<{ audioData: string; format: 'mp3' }> {
    if (options?.description && !options?.voiceId) {
      return this.parlerTtsService.speak(text, { description: options.description, tenantId: options.tenantId });
    }

    // The workspace's voice choice; otherwise its chat provider's voice; otherwise Mistral.
    const prefs = await this.getTenantPreferences(options?.tenantId);
    const provider = prefs.voice ?? (prefs.chat && CHAT_PROVIDERS.has(prefs.chat) ? prefs.chat : IntegrationProvider.MISTRAL);

    if (provider === IntegrationProvider.OPENAI) return this.openAiService.speak(text, options as any);
    if (provider === IntegrationProvider.GEMINI) return this.geminiService.speak(text, options);
    if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.speak(text, options);
    if (provider === IntegrationProvider.SELF_HOSTED_PARLER) return this.parlerTtsService.speak(text, options);

    return this.mistralService.speak(text, options);
  }

  async embed(text: string, tenantId?: string): Promise<number[]> {
    const provider = await this.getProvider(tenantId);
    
    if (provider === IntegrationProvider.OPENAI) return this.openAiService.embed(text, tenantId);
    if (provider === IntegrationProvider.GEMINI) return this.geminiService.embed(text, tenantId);
    if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.embed(text, tenantId);

    return this.mistralService.embed(text, tenantId);
  }

  async embedBatch(texts: string[], tenantId?: string): Promise<number[][]> {
    const provider = await this.getProvider(tenantId);
    
    if (provider === IntegrationProvider.OPENAI) return this.openAiService.embedBatch(texts, tenantId);
    if (provider === IntegrationProvider.GEMINI) return this.geminiService.embedBatch(texts, tenantId);
    if (provider === IntegrationProvider.DEEPSEEK) return this.deepseekService.embedBatch(texts, tenantId);

    return this.mistralService.embedBatch(texts, tenantId);
  }
}
