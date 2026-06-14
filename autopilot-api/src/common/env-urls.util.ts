import type { ConfigService } from '@nestjs/config';

/** Frontend origin for OAuth redirects and emails (FRONTEND_URL or legacy APP_URL). */
export function resolveFrontendUrl(config?: ConfigService): string {
  const raw =
    config?.get<string>('FRONTEND_URL')?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    config?.get<string>('APP_URL')?.trim() ||
    process.env.APP_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

/** Public API base URL (API_PUBLIC_URL or legacy API_URL). */
export function resolveApiPublicUrl(config?: ConfigService): string {
  const raw =
    config?.get<string>('API_PUBLIC_URL')?.trim() ||
    process.env.API_PUBLIC_URL?.trim() ||
    config?.get<string>('API_URL')?.trim() ||
    process.env.API_URL?.trim() ||
    '';
  return raw.replace(/\/$/, '');
}
