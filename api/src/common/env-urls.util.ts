import type { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';

/** Vite dev server port (client/vite.config.ts). */
export function defaultViteDevPort(): string {
  return process.env.CLIENT_DEV_PORT?.trim() || '5173';
}

/** True when Nest serves the built React app from client/dist on PORT. */
export function isServeClientMode(): boolean {
  return process.env.SERVE_CLIENT === 'true';
}

/** Default browser origin in development. */
export function defaultDevFrontendUrl(): string {
  const explicit = process.env.CLIENT_DEV_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  if (isServeClientMode()) {
    const port = process.env.PORT || '4000';
    return `http://localhost:${port}`;
  }

  const vitePort = defaultViteDevPort();
  return `http://localhost:${vitePort}`;
}

/** API origin in development (Nest on PORT). */
export function defaultDevApiOrigin(): string {
  const port = process.env.PORT || '4000';
  return `http://localhost:${port}`;
}

/** When API-only dev, FRONTEND_URL must not point at Nest (no SPA there). */
export function normalizeDevFrontendUrl(): void {
  if (process.env.NODE_ENV === 'production') return;

  const apiOrigin = defaultDevApiOrigin();
  const frontend = (
    process.env.FRONTEND_URL?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    ''
  ).replace(/\/$/, '');

  const clientDist = join(process.cwd(), 'client/dist/index.html');
  const hasBuiltClient = existsSync(clientDist);
  const shouldUseVite =
    !isServeClientMode() &&
    (!frontend || frontend === apiOrigin) &&
    !hasBuiltClient;

  if (shouldUseVite) {
    const viteOrigin = defaultDevFrontendUrl();
    if (frontend && frontend !== viteOrigin) {
      console.warn(
        `[urls] FRONTEND_URL=${frontend} points at the API, but SERVE_CLIENT is not enabled — using Vite dev server ${viteOrigin} for OAuth redirects`,
      );
    }
    process.env.FRONTEND_URL = viteOrigin;
    if (!process.env.CLIENT_URL?.trim()) {
      process.env.CLIENT_URL = viteOrigin;
    }
  } else if (!process.env.FRONTEND_URL?.trim()) {
    process.env.FRONTEND_URL = defaultDevFrontendUrl();
  }
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
      process.env.FRONTEND_URL?.trim() ||
      process.env.API_PUBLIC_URL?.trim() ||
      publicUrl;
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
    console.log(
      '[urls] FRONTEND_URL and API_PUBLIC_URL differ — cross-origin mode',
    );
  } else {
    console.log('[urls] Production same-origin:', frontend);
  }
}
