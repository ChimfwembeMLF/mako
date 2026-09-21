import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import axios from 'axios';
import { S3StorageService } from '../../media/s3-storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantIntegrationConfig, IntegrationProvider } from '../../tenants/entities/tenant-integration-config.entity';
import { EncryptionService } from '../../tenants/services/encryption.service';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';

@Injectable()
export class MistralAgentsService {
  private readonly logger = new Logger(MistralAgentsService.name);
  private client: Mistral | null = null;
  private cachedAgentId: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: S3StorageService,
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly encryptionService: EncryptionService,
    private readonly integrations: PlatformIntegrationsService,
  ) {}

  private async getClient(tenantId?: string): Promise<{ client: Mistral; apiKey: string }> {
    let resolvedKey = '';

    if (tenantId) {
      try {
        const customConfig = await this.configRepo.findOne({
          where: { tenantId, provider: IntegrationProvider.MISTRAL },
        });

        if (customConfig) {
          resolvedKey = this.encryptionService.decrypt(
            customConfig.encryptedApiKey,
            customConfig.iv,
            customConfig.authTag,
          ).trim();
        }
      } catch (err) {
        this.logger.error(`Failed to load custom Mistral key for tenant ${tenantId}`, err);
      }
    }

    if (!resolvedKey) {
      const fallbackKey = await this.integrations.getIntegrationWithEnvFallback('MISTRAL_API_KEY');
      if (!fallbackKey?.trim()) {
        throw new ServiceUnavailableException('MISTRAL_API_KEY is not configured');
      }
      resolvedKey = fallbackKey.trim();
    }

    return {
      client: new Mistral({ apiKey: resolvedKey }),
      apiKey: resolvedKey,
    };
  }

  private get imageModel(): string {
    return (
      this.config.get<string>('MISTRAL_IMAGE_AGENT_MODEL') ||
      'mistral-medium-latest'
    );
  }

  private async getOrCreateImageAgent(client: Mistral): Promise<string> {
    const fromEnv = this.config.get<string>('MISTRAL_IMAGE_AGENT_ID');
    if (fromEnv?.trim()) return fromEnv.trim();
    if (this.cachedAgentId) return this.cachedAgentId;
    const agent = await client.beta.agents.create({
      model: this.imageModel,
      name: 'Mako  Image Generator',
      description: 'Generates marketing images',
      instructions:
        'Generate high-quality marketing images when asked. Use the image_generation tool.',
      tools: [{ type: 'image_generation' }],
    });

    if (!agent.id)
      throw new BadRequestException('Failed to create Mistral image agent');
    this.cachedAgentId = agent.id;
    return agent.id;
  }

  async generateImage(
    prompt: string,
    options?: { tenantId?: string },
  ): Promise<{ filePath: string; publicUrl: string; fileId: string }> {
    const { client, apiKey } = await this.getClient(options?.tenantId);
    const agentId = await this.getOrCreateImageAgent(client);

    const response = await client.beta.conversations.start({
      agentId,
      inputs: prompt,
    });

    const fileIds: string[] = [];
    for (const output of response.outputs ?? []) {
      const content = (output as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const chunk of content) {
        const c = chunk as { type?: string; fileId?: string; file_id?: string };
        if (c.type === 'tool_file' || c.fileId || c.file_id) {
          fileIds.push(String(c.fileId ?? c.file_id));
        }
      }
    }

    if (!fileIds.length) {
      throw new BadRequestException(
        'Image generation did not return a file. Check Mistral Agents API access on your account.',
      );
    }

    const fileId = fileIds[0];
    const fileRes = await axios.get<ArrayBuffer>(
      `https://api.mistral.ai/v1/files/${fileId}/content`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        responseType: 'arraybuffer',
      },
    );

    const buffer = Buffer.from(fileRes.data);
    const tenantId = options?.tenantId ?? 'shared';

    this.storage.assertConfigured();
    const uploaded = await this.storage.uploadBuffer({
      tenantId,
      buffer,
      contentType: 'image/png',
      originalName: `ai-${fileId.slice(0, 8)}.png`,
      prefix: 'ai',
    });
    this.logger.log(`Saved generated image → ${uploaded.publicUrl}`);
    return {
      filePath: uploaded.storagePath,
      publicUrl: uploaded.publicUrl,
      fileId,
    };
  }
}
