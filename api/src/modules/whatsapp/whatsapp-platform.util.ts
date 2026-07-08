import { ConfigService } from '@nestjs/config';

export type WhatsappCredentials = {
  phoneNumberId: string;
  accessToken: string;
};

export type WhatsappConnectionMode = 'platform' | 'oauth';

export function isWhatsappPlatformEnabled(config: ConfigService): boolean {
  if (config.get<string>('WHATSAPP_PLATFORM_ENABLED') === 'false') {
    return false;
  }
  const phoneNumberId = config
    .get<string>('WHATSAPP_PLATFORM_PHONE_NUMBER_ID')
    ?.trim();
  const accessToken = config
    .get<string>('WHATSAPP_PLATFORM_ACCESS_TOKEN')
    ?.trim();
  if (phoneNumberId && accessToken) {
    return true;
  }
  return config.get<string>('WHATSAPP_PLATFORM_ENABLED') === 'true';
}

export function getWhatsappPlatformCredentials(
  config: ConfigService,
): WhatsappCredentials | null {
  if (!isWhatsappPlatformEnabled(config)) return null;

  const phoneNumberId = config
    .get<string>('WHATSAPP_PLATFORM_PHONE_NUMBER_ID')
    ?.trim();
  const accessToken = config
    .get<string>('WHATSAPP_PLATFORM_ACCESS_TOKEN')
    ?.trim();
  if (!phoneNumberId || !accessToken) return null;

  return { phoneNumberId, accessToken };
}

export function isPlatformManagedWhatsappAccount(
  metadata?: Record<string, unknown>,
): boolean {
  return metadata?.platform_managed === true;
}
