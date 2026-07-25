import { ConfigService } from '@nestjs/config';

export type WhatsappCredentials = {
  phoneNumberId: string;
  accessToken: string;
  /** WhatsApp Business Account ID — preferred for template Graph APIs */
  wabaId?: string;
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

  const wabaId = config.get<string>('WHATSAPP_PLATFORM_WABA_ID')?.trim();

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
