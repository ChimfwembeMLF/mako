import * as Linking from 'expo-linking';
import { api } from './api';

export type OAuthPickerState =
  | { kind: 'facebook'; setupToken: string; pages: Array<{ id: string; name: string }> }
  | {
      kind: 'youtube';
      setupToken: string;
      channels: Array<{ id: string; title: string }>;
    }
  | {
      kind: 'whatsapp';
      setupToken: string;
      phones: Array<{ id: string; displayPhoneNumber?: string; verifiedName?: string }>;
    };

export type OAuthCallbackParams = {
  connected?: string;
  error?: string;
  facebook_setup?: string;
  youtube_setup?: string;
  whatsapp_setup?: string;
};

export type OAuthCallbackOutcome = {
  successMessage?: string;
  errorMessage?: string;
  picker?: OAuthPickerState;
};

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export function parseOAuthCallbackParams(
  input: Record<string, string | string[] | undefined> | OAuthCallbackParams,
): OAuthCallbackParams {
  const record = input as Record<string, string | string[] | undefined>;
  return {
    connected: readParam(record.connected),
    error: readParam(record.error),
    facebook_setup: readParam(record.facebook_setup ?? record.facebookSetup),
    youtube_setup: readParam(record.youtube_setup ?? record.youtubeSetup),
    whatsapp_setup: readParam(record.whatsapp_setup ?? record.whatsappSetup),
  };
}

export function parseOAuthCallbackUrl(url: string): OAuthCallbackParams {
  const parsed = Linking.parse(url);
  return parseOAuthCallbackParams(parsed.queryParams ?? {});
}

export async function handleOAuthCallback(
  params: OAuthCallbackParams,
): Promise<OAuthCallbackOutcome> {
  if (params.error) {
    return { errorMessage: decodeURIComponent(params.error) };
  }

  if (params.connected) {
    const platform = params.connected.charAt(0).toUpperCase() + params.connected.slice(1);
    return { successMessage: `${platform} connected` };
  }

  if (params.facebook_setup) {
    const setupData = await api.getFacebookSetup(params.facebook_setup);
    const pages = setupData?.pages || [];
    if (pages.length === 1) {
      await api.finalizeFacebook({ setupToken: params.facebook_setup, pageId: pages[0].id });
      return { successMessage: 'Facebook connected' };
    }
    if (pages.length > 1) {
      return {
        picker: { kind: 'facebook', setupToken: params.facebook_setup, pages },
      };
    }
    return { errorMessage: 'No Facebook Pages found on this account' };
  }

  if (params.youtube_setup) {
    const setupData = await api.getYoutubeSetup(params.youtube_setup);
    const channels = setupData?.channels || [];
    if (channels.length === 1) {
      await api.finalizeYoutube({
        setupToken: params.youtube_setup,
        channelId: channels[0].id,
      });
      return { successMessage: 'YouTube connected' };
    }
    if (channels.length > 1) {
      return {
        picker: { kind: 'youtube', setupToken: params.youtube_setup, channels },
      };
    }
    return { errorMessage: 'No YouTube channels found on this account' };
  }

  if (params.whatsapp_setup) {
    const setupData = await api.getWhatsappSetup(params.whatsapp_setup);
    const phones = setupData?.phones || [];
    if (phones.length === 1) {
      await api.finalizeWhatsapp({
        setupToken: params.whatsapp_setup,
        phoneNumberId: phones[0].id,
      });
      return { successMessage: 'WhatsApp connected' };
    }
    if (phones.length > 1) {
      return {
        picker: { kind: 'whatsapp', setupToken: params.whatsapp_setup, phones },
      };
    }
    return { errorMessage: 'No WhatsApp numbers found on this account' };
  }

  return {};
}
