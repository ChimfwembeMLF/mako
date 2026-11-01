import {
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';
import {
  IntegrationProvider,
  TenantIntegrationConfig,
} from '../tenants/entities/tenant-integration-config.entity';
import { DeepseekChatService } from './services/deepseek-chat.service';
import { GeminiChatService } from './services/gemini-chat.service';
import { MistralChatService } from './services/mistral-chat.service';
import { OpenAIChatService } from './services/openai-chat.service';

type HealthCheck = (tenantId: string) => Promise<{ ok: boolean; model: string }>;

/** Lives in the AI module because the provider clients do; the keys themselves are managed in tenants. */
@Controller('api/v1/tenant-integration-configs')
@UseGuards(JwtAuthGuard)
export class AiKeyTestController {
  private readonly checks: Partial<Record<IntegrationProvider, HealthCheck>>;

  constructor(
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly access: TenantAccessService,
    mistral: MistralChatService,
    openai: OpenAIChatService,
    gemini: GeminiChatService,
    deepseek: DeepseekChatService,
  ) {
    this.checks = {
      [IntegrationProvider.MISTRAL]: (id) => mistral.healthCheck(id),
      [IntegrationProvider.OPENAI]: (id) => openai.healthCheck(id),
      [IntegrationProvider.GEMINI]: (id) => gemini.healthCheck(id),
      [IntegrationProvider.DEEPSEEK]: (id) => deepseek.healthCheck(id),
    };
  }

  @Post(':tenantId/:provider/test')
  async testKey(
    @Req() req: { user: { sub: string } },
    @Param('tenantId') tenantId: string,
    @Param('provider') provider: IntegrationProvider,
  ): Promise<{ ok: boolean; message?: string }> {
    await this.access.assertMember(req.user.sub, tenantId, 'settings.billing');

    const check = this.checks[provider];
    // Without a saved key the provider client would quietly use the platform key.
    const config = check
      ? await this.configRepo.findOne({ where: { tenantId, provider } })
      : null;
    if (!check || !config) throw new NotFoundException('No key saved for this provider');

    try {
      const { ok } = await check(tenantId);
      return ok ? { ok } : { ok, message: 'The provider sent an unexpected reply.' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'The provider rejected this key.',
      };
    }
  }
}
