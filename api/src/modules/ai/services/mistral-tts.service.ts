import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { MistralChatService } from './mistral-chat.service';

export type TtsVoiceOption = {
  id: string;
  name: string;
  gender?: string | null;
  description?: string | null;
  languages?: string[];
  isCustom: boolean;
};

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

@Injectable()
export class MistralTtsService {
  private readonly logger = new Logger(MistralTtsService.name);
  private client: Mistral | null = null;
  private presetCache: { at: number; voices: TtsVoiceOption[] } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mistralChat: MistralChatService,
  ) {}

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

  async listPresetVoices(): Promise<TtsVoiceOption[]> {
    const ttlMs = 10 * 60 * 1000;
    if (this.presetCache && Date.now() - this.presetCache.at < ttlMs) {
      return this.presetCache.voices;
    }
    try {
      const client = this.getClient();
      const res = await client.audio.voices.list({
        type: 'preset',
        limit: 100,
      });
      const voices: TtsVoiceOption[] = (res.items ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        gender: v.gender,
        description: v.description,
        languages: v.languages,
        isCustom: false,
      }));
      voices.sort((a, b) => a.name.localeCompare(b.name));
      this.presetCache = { at: Date.now(), voices };
      return voices;
    } catch (err) {
      this.logger.error('Failed to list Mistral preset voices', err);
      if (err instanceof HttpException) throw err;
      if (isMistralNetworkError(err)) {
        throw new ServiceUnavailableException(
          'Cannot reach Mistral AI for voice list.',
        );
      }
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Failed to list voices',
      );
    }
  }

  async cloneVoice(params: {
    name: string;
    sampleBuffer: Buffer;
    sampleFilename: string;
    tenantTag: string;
  }): Promise<{ mistralVoiceId: string; name: string }> {
    if (!params.sampleBuffer?.length) {
      throw new BadRequestException('Audio sample is required');
    }
    if (params.sampleBuffer.length > 12 * 1024 * 1024) {
      throw new BadRequestException('Audio sample must be under 12 MB');
    }
    const name = params.name.trim().slice(0, 120);
    if (!name) throw new BadRequestException('Voice name is required');

    try {
      const client = this.getClient();
      const created = await client.audio.voices.create({
        name,
        sampleAudio: params.sampleBuffer.toString('base64'),
        sampleFilename: params.sampleFilename || 'voice-sample.webm',
        tags: [`tenant:${params.tenantTag}`],
        description: `Cloned voice for tenant ${params.tenantTag}`,
      });
      if (!created.id) {
        throw new BadRequestException('Mistral did not return a voice id');
      }
      return { mistralVoiceId: created.id, name: created.name };
    } catch (err) {
      this.logger.error('Mistral voice clone failed', err);
      if (err instanceof HttpException) throw err;
      if (isMistralNetworkError(err)) {
        throw new ServiceUnavailableException(
          'Cannot reach Mistral AI to clone voice.',
        );
      }
      const msg = err instanceof Error ? err.message : 'Voice cloning failed';
      throw new BadRequestException(msg);
    }
  }

  async deleteCustomVoice(mistralVoiceId: string): Promise<void> {
    try {
      const client = this.getClient();
      await client.audio.voices.delete({ voiceId: mistralVoiceId });
    } catch (err) {
      this.logger.error(
        `Failed to delete Mistral voice ${mistralVoiceId}`,
        err,
      );
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Failed to delete voice';
      throw new BadRequestException(msg);
    }
  }

  speak(text: string, voiceId?: string) {
    return this.mistralChat.speak(text, { voiceId });
  }
}
