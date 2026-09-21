import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);

  constructor(private readonly config: ConfigService) {}

  private getServiceUrl(): string {
    return this.config.get<string>('WHISPER_STT_URL') || 'http://mako-stt:8001';
  }

  async transcribe(audioBuffer: Buffer, mimetype: string, filename: string = 'audio.webm'): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new BadRequestException('No audio data provided');
    }

    const baseUrl = this.getServiceUrl();

    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimetype });
      formData.append('file', blob, filename);

      const response = await fetch(`${baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Whisper STT failed: ${response.status} ${errorText}`);
        throw new ServiceUnavailableException('Failed to transcribe audio using Whisper STT.');
      }

      const data = await response.json();
      return data.text || '';
    } catch (e) {
      this.logger.error('Error hitting STT service', e);
      throw new ServiceUnavailableException('Failed to connect to Whisper STT service.');
    }
  }
}
