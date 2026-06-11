import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotConfig } from '../entities/chatbot-config.entity';
import { SupabaseStorageService } from '../../media/supabase-storage.service';
import { MistralChatbotLibraryService } from './mistral-chatbot-library.service';
import { DEFAULT_CHATBOT_SYSTEM_MESSAGE } from '../constants/default-system-message';
import { compressAvatarModel } from '../utils/avatar-model-compress.util';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const AVATAR_MODEL_MAX_BYTES = 30 * 1024 * 1024;
const AVATAR_MODEL_MAX_MB = AVATAR_MODEL_MAX_BYTES / (1024 * 1024);
const AVATAR_MODEL_MIMES = [
  'model/gltf-binary',
  'model/gltf+json',
  'application/octet-stream',
];
const AVATAR_MODEL_EXTS = ['.glb', '.gltf'];

@Injectable()
export class ChatbotConfigService {
  constructor(
    @InjectRepository(ChatbotConfig)
    private readonly repo: Repository<ChatbotConfig>,
    private readonly storage: SupabaseStorageService,
    private readonly mistralLibrary: MistralChatbotLibraryService,
  ) {}

  async getOrCreate(tenantId: string): Promise<ChatbotConfig> {
    let config = await this.repo.findOne({
      where: { tenantId },
      order: { created_at: 'ASC' },
    });
    if (config) {
      if (!config.systemPromptExtra?.trim()) {
        config.systemPromptExtra = DEFAULT_CHATBOT_SYSTEM_MESSAGE;
        return this.repo.save(config);
      }
      return config;
    }

    try {
      config = await this.repo.save(
        this.repo.create({
          tenantId,
          name: 'Website Assistant',
          welcomeMessage: 'Hi! How can I help you today?',
          systemPromptExtra: DEFAULT_CHATBOT_SYSTEM_MESSAGE,
          widgetTheme: {
            primaryColor: '#6366f1',
            gradientFrom: '#6366f1',
            gradientTo: '#a855f7',
            gradientAngle: 135,
            position: 'bottom-right',
          },
        }),
      );
      return config;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        const existing = await this.repo.findOne({
          where: { tenantId },
          order: { created_at: 'ASC' },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async update(tenantId: string, patch: Partial<ChatbotConfig>): Promise<ChatbotConfig> {
    const config = await this.getOrCreate(tenantId);
    const enablingMistral =
      patch.useMistralLibrary === true && !config.useMistralLibrary;
    const mistralTouched =
      enablingMistral ||
      (config.useMistralLibrary &&
        (patch.useMistralLibrary !== false ||
          patch.name !== undefined ||
          patch.systemPromptExtra !== undefined ||
          patch.brandProfileId !== undefined ||
          patch.model !== undefined ||
          patch.temperature !== undefined));

    Object.assign(config, {
      ...patch,
      tenantId,
      id: config.id,
    });
    if (patch.mistralVoiceId === '') {
      config.mistralVoiceId = undefined;
    }
    let saved = await this.repo.save(config);

    if (saved.useMistralLibrary) {
      saved = await this.mistralLibrary.provision(saved);
      if (mistralTouched) {
        await this.mistralLibrary.syncAgentInstructions(saved);
      }
      void this.mistralLibrary.syncUnsyncedDocuments(tenantId, saved);
    }

    return saved;
  }

  async uploadAvatar(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<ChatbotConfig> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Avatar must be under 2 MB');
    }
    if (!AVATAR_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Use PNG, JPEG, WebP, or GIF');
    }

    this.storage.assertConfigured();
    const uploaded = await this.storage.uploadBuffer({
      tenantId,
      buffer: file.buffer,
      contentType: file.mimetype,
      originalName: file.originalname || 'avatar.png',
      prefix: 'chatbot-avatar',
    });

    const config = await this.getOrCreate(tenantId);
    const theme = { ...(config.widgetTheme ?? {}) };
    theme.avatarUrl = uploaded.publicUrl;
    config.widgetTheme = theme;
    return this.repo.save(config);
  }

  async uploadAvatarModel(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<ChatbotConfig> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (file.size > AVATAR_MODEL_MAX_BYTES) {
      throw new BadRequestException(`3D model must be under ${AVATAR_MODEL_MAX_MB} MB`);
    }

    const ext = (file.originalname || '').toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
    const mimeOk = AVATAR_MODEL_MIMES.includes(file.mimetype);
    const extOk = AVATAR_MODEL_EXTS.includes(ext);
    if (!mimeOk && !extOk) {
      throw new BadRequestException('Upload a GLB or GLTF file');
    }

    this.storage.assertConfigured();

    const extNorm = (ext === '.gltf' ? '.gltf' : '.glb') as '.glb' | '.gltf';
    const compressed = await compressAvatarModel(file.buffer, extNorm);

    const uploaded = await this.storage.uploadBuffer({
      tenantId,
      buffer: compressed.buffer,
      contentType: compressed.contentType,
      originalName: 'avatar.glb',
      prefix: 'chatbot-avatar-model',
    });

    const config = await this.getOrCreate(tenantId);
    const theme = { ...(config.widgetTheme ?? {}) };
    theme.avatarModelUrl = uploaded.publicUrl;
    theme.avatarModelBytes = compressed.compressedBytes;
    theme.avatarModelOriginalBytes = compressed.originalBytes;
    if (!theme.avatarMode || theme.avatarMode === 'image') {
      theme.avatarMode = '3d';
    }
    config.widgetTheme = theme;
    return this.repo.save(config);
  }
}
