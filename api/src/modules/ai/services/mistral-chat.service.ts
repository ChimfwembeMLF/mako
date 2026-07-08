import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

function isMistralNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (
    msg.includes('fetch failed') ||
    msg.includes('eai_again') ||
    msg.includes('enotfound') ||
    msg.includes('network')
  ) {
    return true;
  }
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  return (
    cause?.code === 'EAI_AGAIN' ||
    cause?.code === 'ENOTFOUND' ||
    cause?.code === 'ECONNREFUSED'
  );
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  tokensUsed: number;
  model: string;
}

@Injectable()
export class MistralChatService {
  private readonly logger = new Logger(MistralChatService.name);
  private client: Mistral | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Mistral {
    const apiKey = this.config.get<string>('MISTRAL_API_KEY');
    if (!apiKey?.trim()) {
      throw new ServiceUnavailableException(
        'MISTRAL_API_KEY is not configured on the server',
      );
    }
    if (!this.client) {
      this.client = new Mistral({ apiKey: apiKey.trim() });
    }
    return this.client;
  }

  get defaultModel(): string {
    return (
      this.config.get<string>('MISTRAL_TEXT_MODEL') || 'mistral-small-latest'
    );
  }

  get premiumModel(): string {
    return (
      this.config.get<string>('MISTRAL_PREMIUM_MODEL') || 'mistral-large-latest'
    );
  }

  async complete(
    messages: ChatMessage[],
    options?: { model?: string; jsonMode?: boolean; maxTokens?: number },
  ): Promise<ChatResult> {
    const model = options?.model ?? this.defaultModel;
    try {
      const client = this.getClient();
      const response = await client.chat.complete({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        maxTokens: options?.maxTokens ?? 4096,
        ...(options?.jsonMode
          ? { responseFormat: { type: 'json_object' } }
          : {}),
      });

      const choice = response.choices?.[0];
      const raw = choice?.message?.content;
      const content =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw)
          ? raw
              .map((c) =>
                typeof c === 'string' ? c : (c as { text?: string }).text ?? '',
              )
              .join('')
          : '';

      if (!content.trim()) {
        throw new BadRequestException('Mistral returned an empty response');
      }

      const tokensUsed =
        (response.usage?.totalTokens ?? 0) ||
        (response.usage?.promptTokens ?? 0) +
          (response.usage?.completionTokens ?? 0);

      return { content: content.trim(), tokensUsed, model };
    } catch (err) {
      this.logger.error('Mistral chat completion failed', err);
      if (err instanceof HttpException) {
        throw err;
      }
      if (isMistralNetworkError(err)) {
        throw new ServiceUnavailableException(
          'Cannot reach Mistral AI (api.mistral.ai). Check your internet connection and try again.',
        );
      }
      const msg = err instanceof Error ? err.message : 'Mistral request failed';
      throw new BadRequestException(msg);
    }
  }

  async completeJson<T>(
    messages: ChatMessage[],
    options?: { model?: string },
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
      this.logger.warn(
        `Mistral JSON parse failed. Raw: ${result.content.slice(0, 300)}`,
      );
      throw new BadRequestException(
        'AI returned an invalid response. Try again in a moment.',
      );
    }
  }

  async healthCheck(): Promise<{ ok: boolean; model: string }> {
    const result = await this.complete(
      [{ role: 'user', content: 'Reply with exactly: ok' }],
      { maxTokens: 16 },
    );
    return {
      ok: result.content.toLowerCase().includes('ok'),
      model: result.model,
    };
  }

  get ttsModel(): string {
    return (
      this.config.get<string>('MISTRAL_TTS_MODEL') || 'voxtral-mini-tts-latest'
    );
  }

  /** Mistral preset voice (Paul — neutral). Override via MISTRAL_TTS_VOICE_ID or per-tenant mistralVoiceId. */
  get defaultTtsVoiceId(): string {
    return (
      this.config.get<string>('MISTRAL_TTS_VOICE_ID') ||
      'c69964a6-ab8b-4f8a-9465-ec0925096ec8'
    );
  }

  get embedModel(): string {
    return this.config.get<string>('MISTRAL_EMBED_MODEL') || 'mistral-embed';
  }

  async speak(
    text: string,
    options?: { voiceId?: string; model?: string },
  ): Promise<{ audioData: string; format: 'mp3' }> {
    const input = text.trim().slice(0, 4096);
    if (!input) {
      throw new BadRequestException('No text to synthesize');
    }
    try {
      const client = this.getClient();
      const response = await client.audio.speech.complete({
        model: options?.model ?? this.ttsModel,
        input,
        voiceId: options?.voiceId?.trim() || this.defaultTtsVoiceId,
        responseFormat: 'mp3',
        stream: false,
      });

      if (
        !response ||
        typeof response !== 'object' ||
        !('audioData' in response)
      ) {
        throw new BadRequestException(
          'Mistral TTS returned an unexpected response',
        );
      }

      const audioData = (response as { audioData?: string }).audioData;
      if (!audioData?.trim()) {
        throw new BadRequestException('Mistral TTS returned empty audio');
      }

      return { audioData, format: 'mp3' };
    } catch (err) {
      this.logger.error('Mistral TTS failed', err);
      if (err instanceof HttpException) throw err;
      if (isMistralNetworkError(err)) {
        throw new ServiceUnavailableException(
          'Cannot reach Mistral AI for text-to-speech. Check your connection.',
        );
      }
      const msg = err instanceof Error ? err.message : 'TTS request failed';
      throw new BadRequestException(msg);
    }
  }

  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    try {
      const client = this.getClient();
      const response = await client.embeddings.create({
        model: this.embedModel,
        inputs: texts,
      });
      const data = response.data ?? [];
      return data.map((d) => d.embedding ?? []);
    } catch (err) {
      this.logger.error('Mistral embedding failed', err);
      if (err instanceof HttpException) throw err;
      if (isMistralNetworkError(err)) {
        throw new ServiceUnavailableException(
          'Cannot reach Mistral AI for embeddings. Check your connection.',
        );
      }
      const msg =
        err instanceof Error ? err.message : 'Embedding request failed';
      throw new BadRequestException(msg);
    }
  }
}
