import { ConfigService } from '@nestjs/config';
import { integrationSetting } from '../system_settings/services/platform-integrations.service';

/** Backoffice → Integrations wins over the server environment, like the other platform keys. */
function setting(config: ConfigService, key: string): string | undefined {
  return integrationSetting(key) ?? config.get<string>(key)?.trim() ?? undefined;
}

export type WhatsappCredentials = {
  phoneNumberId: string;
  accessToken: string;
  /** WhatsApp Business Account ID — preferred for template Graph APIs */
  wabaId?: string;
};

export type WhatsappConnectionMode = 'platform' | 'oauth';

export function isWhatsappPlatformEnabled(config: ConfigService): boolean {
  if (setting(config, 'WHATSAPP_PLATFORM_ENABLED') === 'false') {
    return false;
  }
  const phoneNumberId = setting(config, 'WHATSAPP_PLATFORM_PHONE_NUMBER_ID');
  const accessToken = setting(config, 'WHATSAPP_PLATFORM_ACCESS_TOKEN');
  if (phoneNumberId && accessToken) {
    return true;
  }
  return setting(config, 'WHATSAPP_PLATFORM_ENABLED') === 'true';
}

export function getWhatsappPlatformCredentials(
  config: ConfigService,
): WhatsappCredentials | null {
  if (!isWhatsappPlatformEnabled(config)) return null;

  const phoneNumberId = setting(config, 'WHATSAPP_PLATFORM_PHONE_NUMBER_ID');
  const accessToken = setting(config, 'WHATSAPP_PLATFORM_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) return null;

  const wabaId = setting(config, 'WHATSAPP_PLATFORM_WABA_ID');

  return {
    phoneNumberId,
    accessToken,
    ...(wabaId ? { wabaId } : {}),
  };
}

export function isPlatformManagedWhatsappAccount(
  metadata?: Record<string, unknown>,
): boolean {
  return metadata?.platform_managed === true;
}
