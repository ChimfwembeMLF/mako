import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';

@Injectable()
export class ParlerTtsService {
  private readonly logger = new Logger(ParlerTtsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly integrations: PlatformIntegrationsService,
  ) {}

  private async getServiceUrl(): Promise<string> {
    const url = await this.integrations.getIntegrationWithEnvFallback('PARLER_TTS_URL');
    if (!url?.trim()) {
      return 'http://mako-tts:8000';
    }
    return url.trim();
  }

  async speak(
    text: string,
    options?: { description?: string; tenantId?: string },
  ): Promise<{ audioData: string; format: 'mp3' }> {
    const input = text.trim().slice(0, 4096);
    if (!input) {
      throw new BadRequestException('No text to synthesize');
    }

    const description = options?.description?.trim() || "A friendly male speaker with a clear voice.";
    const baseUrl = await this.getServiceUrl();

    try {
      const response = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: input,
          description: description,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Parler TTS failed: ${response.status} ${errorText}`);
        throw new ServiceUnavailableException('Failed to generate speech from Parler TTS service.');
      }

      const buffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(buffer).toString('base64');
      return { audioData: base64Audio, format: 'mp3' };
    } catch (err) {
      this.logger.error('Parler TTS network request failed', err);
      if (err instanceof ServiceUnavailableException || err instanceof BadRequestException) {
        throw err;
      }
      throw new ServiceUnavailableException('Cannot reach self-hosted Parler TTS service.');
    }
  }
}
