import axios from 'axios';
import { BadRequestException } from '@nestjs/common';

type GraphErrorBody = {
  error?: {
    message?: string;
    error_user_msg?: string;
    error_user_title?: string;
    code?: number;
    type?: string;
  };
};

export function formatGraphApiError(err: unknown, prefix: string): string {
  if (axios.isAxiosError(err)) {
    const fb = err.response?.data as GraphErrorBody | undefined;
    const detail =
      fb?.error?.error_user_msg ??
      fb?.error?.message ??
      err.message;
    const code = fb?.error?.code ? ` (Meta error ${fb.error.code})` : '';
    return `${prefix}: ${detail}${code}`;
  }
  if (err instanceof Error) return `${prefix}: ${err.message}`;
  return `${prefix}: ${String(err)}`;
}

export async function assertMetaAdsPermissions(accessToken: string): Promise<void> {
  try {
    const { data } = await axios.get<{
      data?: Array<{ permission: string; status: string }>;
    }>('https://graph.facebook.com/v19.0/me/permissions', {
      params: { access_token: accessToken },
    });

    const granted = new Set(
      (data.data ?? [])
        .filter((p) => p.status === 'granted')
        .map((p) => p.permission),
    );

    const required = ['ads_management', 'ads_read'];
    const missing = required.filter((r) => !granted.has(r));
    if (missing.length) {
      throw new BadRequestException(
        `Facebook is missing ads permissions (${missing.join(', ')}). Open Publisher Connect → disconnect Facebook → reconnect so Meta can grant ads access.`,
      );
    }
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      formatGraphApiError(
        err,
        'Could not verify Facebook ads permissions — try reconnecting Facebook in Publisher Connect',
      ),
    );
  }
}

export async function fetchMetaAdAccountId(accessToken: string): Promise<string> {
  try {
    const { data } = await axios.get<{
      data?: Array<{ id: string; account_id?: string; name?: string }>;
    }>('https://graph.facebook.com/v19.0/me/adaccounts', {
      params: {
        access_token: accessToken,
        fields: 'id,account_id,name',
        limit: 10,
      },
    });

    const first = data.data?.[0];
    if (!first?.id) {
      throw new BadRequestException(
        'No Meta ad account linked to this Facebook user. Create one at https://business.facebook.com/adsmanager or set META_AD_ACCOUNT_ID in .env.',
      );
    }
    return first.id;
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      formatGraphApiError(
        err,
        'Meta ad account lookup failed — reconnect Facebook in Publisher Connect or set META_AD_ACCOUNT_ID',
      ),
    );
  }
}
