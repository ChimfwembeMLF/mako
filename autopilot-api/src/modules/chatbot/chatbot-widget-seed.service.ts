import { Injectable, Logger } from '@nestjs/common';
import { ChatApiKeyService } from './services/chat-api-key.service';
import { ChatbotConfigService } from './services/chatbot-config.service';

@Injectable()
export class ChatbotWidgetSeedService {
  private readonly logger = new Logger(ChatbotWidgetSeedService.name);

  constructor(
    private readonly chatbotConfig: ChatbotConfigService,
    private readonly apiKeys: ChatApiKeyService,
  ) {}

  /**
   * Enable the embeddable widget for a tenant and ensure a usable API key exists.
   * Uses `opts.secret`, then MAKO_WIDGET_API_KEY / DEMO_WIDGET_API_KEY (match VITE_WIDGET_API_KEY in the client).
   */
  async ensureSeededForTenant(
    tenantId: string,
    opts?: { secret?: string; label?: string },
  ): Promise<{ secret?: string; action: string }> {
    const config = await this.chatbotConfig.getOrCreate(tenantId);

    if (!config.widgetEnabled || !config.isActive) {
      await this.chatbotConfig.update(tenantId, { widgetEnabled: true, isActive: true });
    }

    const fixedKey =
      opts?.secret?.trim() ||
      process.env.MAKO_WIDGET_API_KEY?.trim() ||
      process.env.DEMO_WIDGET_API_KEY?.trim();
    if (fixedKey) {
      const label =
        opts?.label ??
        (process.env.MAKO_WIDGET_API_KEY ? 'Mako embed' : 'Demo embed');
      await this.apiKeys.ensureWidgetKey({
        tenantId,
        configId: config.id,
        secret: fixedKey,
        label,
      });
      this.logger.log(`Widget API key synced for tenant ${tenantId}`);
      return { secret: fixedKey, action: 'synced' };
    }

    const keys = await this.apiKeys.listKeys(tenantId);
    const active = keys.filter((k) => !k.revokedAt);
    if (active.length) {
      this.logger.log(`Widget already has ${active.length} active key(s) for tenant ${tenantId}`);
      return { action: 'skipped' };
    }

    const { secret } = await this.apiKeys.createKey({
      tenantId,
      configId: config.id,
      label: 'Demo embed',
    });
    this.logger.log(`Created widget API key for tenant ${tenantId}`);
    return { secret, action: 'created' };
  }
}
