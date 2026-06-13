import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ChatbotApiKey } from '../entities/chatbot-api-key.entity';
import { ChatbotConfig } from '../entities/chatbot-config.entity';

export interface ApiKeyValidation {
  key: ChatbotApiKey;
  config: ChatbotConfig;
}

@Injectable()
export class ChatApiKeyService {
  constructor(
    @InjectRepository(ChatbotApiKey)
    private readonly keyRepo: Repository<ChatbotApiKey>,
    @InjectRepository(ChatbotConfig)
    private readonly configRepo: Repository<ChatbotConfig>,
  ) {}

  private hashKey(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Idempotently register a known secret (dev seed / fixed demo key). */
  async ensureWidgetKey(params: {
    tenantId: string;
    configId: string;
    secret: string;
    label?: string;
  }): Promise<void> {
    const { tenantId, configId, secret, label } = params;
    if (!secret.startsWith('pk_live_')) {
      throw new Error('Widget API key must start with pk_live_');
    }

    const prefix = secret.split('_').slice(0, 3).join('_');
    const keyHash = this.hashKey(secret);

    const existing = await this.keyRepo.findOne({
      where: { tenantId, configId, keyPrefix: prefix },
    });

    if (existing) {
      existing.keyHash = keyHash;
      existing.revokedAt = null;
      if (label) existing.label = label;
      await this.keyRepo.save(existing);
      return;
    }

    await this.keyRepo.save(
      this.keyRepo.create({
        tenantId,
        configId,
        keyPrefix: prefix,
        keyHash,
        label: label ?? 'Demo embed',
      }),
    );
  }

  async createKey(params: {
    tenantId: string;
    configId: string;
    label?: string;
  }): Promise<{ id: string; keyPrefix: string; secret: string; label?: string }> {
    // pk_live_ (8) + 8 hex = 16 chars — fits key_prefix column
    const prefix = `pk_live_${randomBytes(4).toString('hex')}`;
    const secretSuffix = randomBytes(18).toString('hex');
    const secret = `${prefix}_${secretSuffix}`;

    const entity = this.keyRepo.create({
      tenantId: params.tenantId,
      configId: params.configId,
      keyPrefix: prefix,
      keyHash: this.hashKey(secret),
      label: params.label,
    });
    const saved = await this.keyRepo.save(entity);
    return { id: saved.id, keyPrefix: prefix, secret, label: params.label };
  }

  async listKeys(tenantId: string): Promise<ChatbotApiKey[]> {
    return this.keyRepo.find({
      where: { tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async revokeKey(tenantId: string, keyId: string): Promise<void> {
    const key = await this.keyRepo.findOne({ where: { id: keyId, tenantId } });
    if (!key) throw new NotFoundException('API key not found');
    key.revokedAt = new Date();
    await this.keyRepo.save(key);
  }

  async validateBearerToken(token: string): Promise<ApiKeyValidation> {
    const raw = token.replace(/^Bearer\s+/i, '').trim();
    if (!raw.startsWith('pk_live_')) {
      throw new NotFoundException('Invalid API key');
    }

    const prefix = raw.split('_').slice(0, 3).join('_');
    const key = await this.keyRepo.findOne({
      where: { keyPrefix: prefix },
    });

    if (!key || key.revokedAt) {
      throw new NotFoundException('Invalid API key');
    }

    if (key.keyHash !== this.hashKey(raw)) {
      throw new NotFoundException('Invalid API key');
    }

    const config = await this.configRepo.findOne({
      where: { id: key.configId, tenantId: key.tenantId },
    });
    if (!config?.isActive || !config.widgetEnabled) {
      throw new NotFoundException('Chatbot widget is not enabled');
    }

    key.lastUsedAt = new Date();
    await this.keyRepo.save(key);

    return { key, config };
  }
}
