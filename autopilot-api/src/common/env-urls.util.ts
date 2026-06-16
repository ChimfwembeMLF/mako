import type { ConfigService } from '@nestjs/config';

/** Default browser origin in development (Nest serves SPA on PORT). */
export function defaultDevFrontendUrl(): string {
  const port = process.env.PORT || '4000';
  return `http://localhost:${port}`;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** Sync production URLs — single domain for SPA + API. */
export function normalizeProductionUrls(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const publicUrl = firstNonEmpty(
    process.env.API_PUBLIC_URL,
    process.env.API_URL,
    process.env.API_BASE_URL,
    process.env.APP_URL,
  );

  if (!process.env.FRONTEND_URL?.trim() && publicUrl) {
    process.env.FRONTEND_URL = publicUrl;
  }
  if (!process.env.API_PUBLIC_URL?.trim() && publicUrl) {
    process.env.API_PUBLIC_URL = publicUrl;
  }
  if (!process.env.CLIENT_URL?.trim()) {
    process.env.CLIENT_URL =
      process.env.FRONTEND_URL?.trim() || process.env.API_PUBLIC_URL?.trim() || publicUrl;
  }
}

/** Frontend origin for OAuth redirects and emails (FRONTEND_URL or legacy APP_URL). */
export function resolveFrontendUrl(config?: ConfigService): string {
  const direct = firstNonEmpty(
    config?.get<string>('FRONTEND_URL'),
    process.env.FRONTEND_URL,
    config?.get<string>('CLIENT_URL'),
    process.env.CLIENT_URL,
    config?.get<string>('APP_URL'),
    process.env.APP_URL,
  );
  if (direct) return direct.replace(/\/$/, '');

  const apiPublic = resolveApiPublicUrl(config);
  if (apiPublic) return apiPublic;

  if (process.env.NODE_ENV !== 'production') {
    return defaultDevFrontendUrl();
  }

  return '';
}

/** Public API base URL (API_PUBLIC_URL or legacy API_URL). */
export function resolveApiPublicUrl(config?: ConfigService): string {
  const raw = firstNonEmpty(
    config?.get<string>('API_PUBLIC_URL'),
    process.env.API_PUBLIC_URL,
    config?.get<string>('API_URL'),
    process.env.API_URL,
    config?.get<string>('API_BASE_URL'),
    process.env.API_BASE_URL,
  );
  return raw.replace(/\/$/, '');
}

export function isLocalhostUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

/** Exit on missing/localhost public URLs in production. */
export function assertProductionUrls(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const frontend = resolveFrontendUrl();
  if (!frontend || isLocalhostUrl(frontend)) {
    console.error(
      'FATAL: Set FRONTEND_URL=https://your-domain.com in production .env (same as API_PUBLIC_URL for single-app deploy)',
    );
    process.exit(1);
  }

  const api = resolveApiPublicUrl();
  if (!api.startsWith('https://')) {
    console.warn('WARNING: API_PUBLIC_URL should be https:// in production');
  }

  if (frontend !== api.replace(/\/$/, '') && api) {
    console.log('[urls] FRONTEND_URL and API_PUBLIC_URL differ — cross-origin mode');
  } else {
    console.log('[urls] Production same-origin:', frontend);
  }
}
