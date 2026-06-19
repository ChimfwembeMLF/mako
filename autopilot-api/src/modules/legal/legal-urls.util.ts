import { ConfigService } from '@nestjs/config';
import {
  resolveApiPublicUrl,
  resolveFrontendUrl,
} from '../../common/env-urls.util';

export type LegalUrls = {
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  dataDeletionUrl: string;
};

/** Absolute URLs for developer portals (TikTok, Meta, LinkedIn app settings). */
export function resolveLegalUrls(config: ConfigService): LegalUrls {
  const frontend = resolveFrontendUrl(config);
  const api =
    resolveApiPublicUrl(config) ||
    `http://localhost:${process.env.PORT || 4000}`;

  const privacyPolicyUrl =
    config.get<string>('PRIVACY_POLICY_URL')?.trim() || `${api}/privacy`;
  const termsOfServiceUrl =
    config.get<string>('TERMS_OF_SERVICE_URL')?.trim() || `${api}/terms`;
  const dataDeletionUrl =
    config.get<string>('DATA_DELETION_URL')?.trim() ||
    `${frontend}/data-deletion`;

  return { privacyPolicyUrl, termsOfServiceUrl, dataDeletionUrl };
}
