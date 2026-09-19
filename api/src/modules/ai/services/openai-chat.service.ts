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
import { ChatMessage, ChatResult } from './mistral-chat.service';

@Injectable()
export class OpenAIChatService {
  private readonly logger = new Logger(OpenAIChatService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly encryptionService: EncryptionService,
    private readonly integrations: PlatformIntegrationsService,
  ) {}

  private async getClient(tenantId?: string): Promise<OpenAI> {
    if (tenantId) {
      try {
        const customConfig = await this.configRepo.findOne({
          where: { tenantId, provider: IntegrationProvider.OPENAI },
        });

        if (customConfig) {
          const decryptedKey = this.encryptionService.decrypt(
            customConfig.encryptedApiKey,
            customConfig.iv,
            customConfig.authTag,
          );
          return new OpenAI({ apiKey: decryptedKey.trim() });
        }
      } catch (err) {
        this.logger.error(`Failed to load custom OpenAI key for tenant ${tenantId}`, err);
      }
    }

    const apiKey = await this.integrations.getIntegrationWithEnvFallback('OPENAI_API_KEY');
    if (!apiKey?.trim()) {
      throw new ServiceUnavailableException('OPENAI_API_KEY is not configured on the server');
    }
    return new OpenAI({ apiKey: apiKey.trim() });
  }

  get defaultModel(): string {
    return this.config.get<string>('OPENAI_TEXT_MODEL') || 'gpt-4o-mini';
  }

  get premiumModel(): string {
    return this.config.get<string>('OPENAI_PREMIUM_MODEL') || 'gpt-4o';
  }

  get embedModel(): string {
    return this.config.get<string>('OPENAI_EMBED_MODEL') || 'text-embedding-3-small';
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
        throw new BadRequestException('OpenAI returned an empty response');
      }

      const tokensUsed = response.usage?.total_tokens ?? 0;

      return { content: content.trim(), tokensUsed, model };
    } catch (err) {
      this.logger.error('OpenAI chat completion failed', err);
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'OpenAI request failed';
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
      this.logger.warn(`OpenAI JSON parse failed. Raw: ${result.content.slice(0, 300)}`);
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
    const input = text.trim().slice(0, 4096);
    if (!input) {
      throw new BadRequestException('No text to synthesize');
    }
    try {
      const client = await this.getClient(options?.tenantId);
      const response = await client.audio.speech.create({
        model: options?.model || 'tts-1',
        input,
        voice: (options?.voiceId?.trim() || 'alloy') as any,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      return { audioData: buffer.toString('base64'), format: 'mp3' };
    } catch (err) {
      this.logger.error('OpenAI TTS failed', err);
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'TTS request failed';
      throw new BadRequestException(msg);
    }
  }

  async embed(text: string, tenantId?: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text], tenantId);
    return embedding;
  }

  async embedBatch(texts: string[], tenantId?: string): Promise<number[][]> {
    if (!texts.length) return [];
    try {
      const client = await this.getClient(tenantId);
      const response = await client.embeddings.create({
        model: this.embedModel,
        input: texts,
      });
      return response.data.map((d) => d.embedding);
    } catch (err) {
      this.logger.error('OpenAI embedding failed', err);
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Embedding request failed';
      throw new BadRequestException(msg);
    }
  }
}
