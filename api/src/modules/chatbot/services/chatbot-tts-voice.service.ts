import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotTtsVoice } from '../entities/chatbot-tts-voice.entity';
import { ChatbotConfigService } from './chatbot-config.service';
import { MistralTtsService } from '../../ai/services/mistral-tts.service';

@Injectable()
export class ChatbotTtsVoiceService {
  constructor(
    @InjectRepository(ChatbotTtsVoice)
    private readonly repo: Repository<ChatbotTtsVoice>,
    private readonly mistralTts: MistralTtsService,
    private readonly configService: ChatbotConfigService,
  ) {}

  async listForTenant(tenantId: string) {
    const [presets, customRows, config] = await Promise.all([
      this.mistralTts.listPresetVoices(),
      this.repo.find({ where: { tenantId }, order: { created_at: 'DESC' } }),
      this.configService.getOrCreate(tenantId),
    ]);

    const custom = customRows.map((row) => ({
      id: row.id,
      mistralVoiceId: row.mistralVoiceId,
      parlerVoiceDescription: row.parlerVoiceDescription,
      name: row.name,
      created_at: row.created_at,
    }));

    return {
      presets,
      custom,
      selectedVoiceId: config.mistralVoiceId ?? null,
    };
  }

  async cloneVoice(
    tenantId: string,
    userId: string,
    params: { name: string; sampleBuffer: Buffer; sampleFilename: string },
  ) {
    const { mistralVoiceId, name } = await this.mistralTts.cloneVoice({
      name: params.name,
      sampleBuffer: params.sampleBuffer,
      sampleFilename: params.sampleFilename,
      tenantTag: tenantId,
    });

    let row = await this.repo.findOne({ where: { tenantId, mistralVoiceId } });
    if (!row) {
      row = await this.repo.save(
        this.repo.create({
          tenantId,
          mistralVoiceId,
          name,
          createdBy: userId,
        }),
      );
    }

    await this.configService.update(tenantId, { mistralVoiceId });

    return {
      voice: {
        id: row.id,
        mistralVoiceId: row.mistralVoiceId,
        parlerVoiceDescription: row.parlerVoiceDescription,
        name: row.name,
        created_at: row.created_at,
      },
      selectedVoiceId: mistralVoiceId,
    };
  }

  async createParlerVoice(
    tenantId: string,
    userId: string,
    params: { name: string; description: string },
  ) {
    const row = await this.repo.save(
      this.repo.create({
        tenantId,
        name: params.name,
        parlerVoiceDescription: params.description,
        createdBy: userId,
      }),
    );

    await this.configService.update(tenantId, { parlerVoiceDescription: params.description });

    return {
      voice: {
        id: row.id,
        mistralVoiceId: row.mistralVoiceId,
        parlerVoiceDescription: row.parlerVoiceDescription,
        name: row.name,
        created_at: row.created_at,
      },
      selectedDescription: params.description,
    };
  }

  async deleteCustomVoice(tenantId: string, voiceRowId: string) {
    const row = await this.repo.findOne({
      where: { id: voiceRowId, tenantId },
    });
    if (!row) throw new NotFoundException('Voice not found');

    if (row.mistralVoiceId) {
      await this.mistralTts.deleteCustomVoice(tenantId, row.mistralVoiceId);
    }
    await this.repo.remove(row);

    const config = await this.configService.getOrCreate(tenantId);
    if (row.mistralVoiceId && config.mistralVoiceId === row.mistralVoiceId) {
      await this.configService.update(tenantId, { mistralVoiceId: '' });
    } else if (row.parlerVoiceDescription && config.parlerVoiceDescription === row.parlerVoiceDescription) {
      await this.configService.update(tenantId, { parlerVoiceDescription: '' });
    }

    return { success: true };
  }
}
