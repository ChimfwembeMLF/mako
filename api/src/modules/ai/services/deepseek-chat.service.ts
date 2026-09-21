import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantIntegrationConfig, IntegrationProvider } from '../../tenants/entities/tenant-integration-config.entity';
import { EncryptionService } from '../../tenants/services/encryption.service';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';
import { ChatMessage, ChatResult, MistralChatService } from './mistral-chat.service';

@Injectable()
export class DeepseekChatService {
  private readonly logger = new Logger(DeepseekChatService.name);
  private readonly baseURL = 'https://api.deepseek.com/v1';

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly encryptionService: EncryptionService,
    private readonly integrations: PlatformIntegrationsService,
    private readonly mistralService: MistralChatService, // For fallbacks
  ) {}

  private async getClient(tenantId?: string): Promise<OpenAI> {
    if (tenantId) {
      try {
        const customConfig = await this.configRepo.findOne({
          where: { tenantId, provider: IntegrationProvider.DEEPSEEK },
        });

        if (customConfig) {
          const decryptedKey = this.encryptionService.decrypt(
            customConfig.encryptedApiKey,
            customConfig.iv,
            customConfig.authTag,
          );
          return new OpenAI({ apiKey: decryptedKey.trim(), baseURL: this.baseURL });
        }
      } catch (err) {
        this.logger.error(`Failed to load custom DeepSeek key for tenant ${tenantId}`, err);
      }
    }

    const apiKey = await this.integrations.getIntegrationWithEnvFallback('DEEPSEEK_API_KEY');
    if (!apiKey?.trim()) {
      throw new ServiceUnavailableException('DEEPSEEK_API_KEY is not configured on the server');
    }
    return new OpenAI({ apiKey: apiKey.trim(), baseURL: this.baseURL });
  }

  get defaultModel(): string {
    return this.config.get<string>('DEEPSEEK_TEXT_MODEL') || 'deepseek-chat';
  }

  get premiumModel(): string {
    return this.config.get<string>('DEEPSEEK_PREMIUM_MODEL') || 'deepseek-chat';
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
      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: options?.maxTokens ?? 4096,
        ...(options?.temperature != null ? { temperature: options.temperature } : {}),
        ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      });

      const choice = response.choices?.[0];
      const content = choice?.message?.content;

      if (!content || !content.trim()) {
        throw new BadRequestException('DeepSeek returned an empty response');
      }

      const tokensUsed = response.usage?.total_tokens ?? 0;

      return { content: content.trim(), tokensUsed, model };
    } catch (err) {
      this.logger.error('DeepSeek chat completion failed', err);
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'DeepSeek request failed';
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
      this.logger.warn(`DeepSeek JSON parse failed. Raw: ${result.content.slice(0, 300)}`);
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
    options?: { voiceId?: string; model?: string; tenantId?: string; description?: string },
  ): Promise<{ audioData: string; format: 'mp3' }> {
    this.logger.log(`DeepSeek TTS not supported, falling back to Mistral for tenant ${options?.tenantId}`);
    return this.mistralService.speak(text, options);
  }

  async embed(text: string, tenantId?: string): Promise<number[]> {
    this.logger.log(`DeepSeek Embeddings not supported natively, falling back to Mistral for tenant ${tenantId}`);
    return this.mistralService.embed(text, tenantId);
  }

  async embedBatch(texts: string[], tenantId?: string): Promise<number[][]> {
    this.logger.log(`DeepSeek Embeddings not supported natively, falling back to Mistral for tenant ${tenantId}`);
    return this.mistralService.embedBatch(texts, tenantId);
  }
}
