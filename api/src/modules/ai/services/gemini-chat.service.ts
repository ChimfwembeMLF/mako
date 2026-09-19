import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantIntegrationConfig, IntegrationProvider } from '../../tenants/entities/tenant-integration-config.entity';
import { EncryptionService } from '../../tenants/services/encryption.service';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';
import { ChatMessage, ChatResult, MistralChatService } from './mistral-chat.service';

@Injectable()
export class GeminiChatService {
  private readonly logger = new Logger(GeminiChatService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly encryptionService: EncryptionService,
    private readonly integrations: PlatformIntegrationsService,
    private readonly mistralService: MistralChatService, // For fallbacks
  ) {}

  private async getClient(tenantId?: string): Promise<GoogleGenAI> {
    if (tenantId) {
      try {
        const customConfig = await this.configRepo.findOne({
          where: { tenantId, provider: IntegrationProvider.GEMINI },
        });

        if (customConfig) {
          const decryptedKey = this.encryptionService.decrypt(
            customConfig.encryptedApiKey,
            customConfig.iv,
            customConfig.authTag,
          );
          return new GoogleGenAI({ apiKey: decryptedKey.trim() });
        }
      } catch (err) {
        this.logger.error(`Failed to load custom Gemini key for tenant ${tenantId}`, err);
      }
    }

    const apiKey = await this.integrations.getIntegrationWithEnvFallback('GEMINI_API_KEY');
    if (!apiKey?.trim()) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured on the server');
    }
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  }

  get defaultModel(): string {
    return this.config.get<string>('GEMINI_TEXT_MODEL') || 'gemini-1.5-flash';
  }

  get premiumModel(): string {
    return this.config.get<string>('GEMINI_PREMIUM_MODEL') || 'gemini-1.5-pro';
  }

  get embedModel(): string {
    return this.config.get<string>('GEMINI_EMBED_MODEL') || 'text-embedding-004';
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
    const model = options?.model ?? this.defaultModel;
    try {
      const client = await this.getClient(options?.tenantId);
      
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'user' : m.role,
        parts: [{ text: m.content }]
      }));

      // Gemini requires the first message to be from 'user'. If it's a system message, we bundle it.
      if (contents.length > 0 && messages[0].role === 'system') {
        contents[0].role = 'user';
        contents[0].parts[0].text = `System Instruction:\n${messages[0].content}`;
      }

      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          maxOutputTokens: options?.maxTokens ?? 4096,
          ...(options?.temperature != null ? { temperature: options.temperature } : {}),
          ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
        }
      });

      const content = response.text;

      if (!content || !content.trim()) {
        throw new BadRequestException('Gemini returned an empty response');
      }

      // GoogleGenAI SDK doesn't always provide usage metadata seamlessly in generateContent, but we can try
      const tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;

      return { content: content.trim(), tokensUsed, model };
    } catch (err) {
      this.logger.error('Gemini chat completion failed', err);
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Gemini request failed';
      throw new BadRequestException(msg);
    }
  }

  async completeJson<T>(
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number; tenantId?: string },
  ): Promise<{ data: T; tokensUsed: number; model: string }> {
    const result = await this.complete(messages, {
      ...options,
      jsonMode: true,
    });
    try {
      const cleaned = result.content
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '');
      return {
        data: JSON.parse(cleaned) as T,
        tokensUsed: result.tokensUsed,
        model: result.model,
      };
    } catch {
      this.logger.warn(`Gemini JSON parse failed. Raw: ${result.content.slice(0, 300)}`);
      throw new BadRequestException('AI returned an invalid response. Try again in a moment.');
    }
  }

  async healthCheck(tenantId?: string): Promise<{ ok: boolean; model: string }> {
    const result = await this.complete(
      [{ role: 'user', content: 'Reply with exactly: ok' }],
      { maxTokens: 16, tenantId },
    );
    return {
      ok: result.content.toLowerCase().includes('ok'),
      model: result.model,
    };
  }

  async speak(
    text: string,
    options?: { voiceId?: string; model?: string; tenantId?: string },
  ): Promise<{ audioData: string; format: 'mp3' }> {
    // Gemini does not have a public TTS API via this SDK. Fallback to Mistral.
    this.logger.log(`Gemini TTS not supported, falling back to Mistral for tenant ${options?.tenantId}`);
    return this.mistralService.speak(text, options);
  }

  async embed(text: string, tenantId?: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text], tenantId);
    return embedding;
  }

  async embedBatch(texts: string[], tenantId?: string): Promise<number[][]> {
    if (!texts.length) return [];
    try {
      const client = await this.getClient(tenantId);
      const responses = await Promise.all(
        texts.map(text => client.models.embedContent({
          model: this.embedModel,
          contents: text,
        }))
      );
      
      return responses.map(r => r.embeddings?.[0]?.values ?? []);
    } catch (err) {
      this.logger.error('Gemini embedding failed', err);
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Embedding request failed';
      throw new BadRequestException(msg);
    }
  }
}
