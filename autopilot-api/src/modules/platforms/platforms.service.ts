import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PLATFORM_CAPABILITIES, PlatformCapability } from '../../constants/platform-capabilities';
import {
  getWhatsappPlatformCredentials,
  isWhatsappPlatformEnabled,
  WhatsappConnectionMode,
} from '../whatsapp/whatsapp-platform.util';

export type PlatformCapabilitiesResponse = {
  platforms: PlatformCapability[];
  whatsapp: {
    connectionMode: WhatsappConnectionMode;
    platformConfigured: boolean;
    displayName?: string;
    displayPhone?: string;
  };
};

@Injectable()
export class PlatformsService {
  constructor(private readonly config: ConfigService) {}

  getCapabilities(): PlatformCapabilitiesResponse {
    const platformConfigured = isWhatsappPlatformEnabled(this.config);
    const connectionMode: WhatsappConnectionMode = platformConfigured ? 'platform' : 'oauth';
    const platformCreds = getWhatsappPlatformCredentials(this.config);

    const platforms = PLATFORM_CAPABILITIES.map((p) => {
      if (p.id !== 'whatsapp') return p;

      if (platformConfigured) {
        return {
          ...p,
          oauth: false,
          notes:
            'Included with AutoPilot — enable for this workspace. No Meta Developer setup required for your clients.',
        };
      }

      return {
        ...p,
        notes:
          'For businesses with their own Meta WhatsApp Business account. Your clients sign in with Meta — no Developer Console access needed on their side.',
      };
    });

    return {
      platforms,
      whatsapp: {
        connectionMode,
        platformConfigured,
        displayName: this.config.get<string>('WHATSAPP_PLATFORM_DISPLAY_NAME')?.trim(),
        displayPhone: this.config.get<string>('WHATSAPP_PLATFORM_DISPLAY_PHONE')?.trim(),
      },
    };
  }
}
