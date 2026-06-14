import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const MAKO_CORS_BUILD = 'cors-v14';

/** LiteSpeed sometimes merges duplicate Origin headers into one comma-separated value. */
export function normalizeRequestOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  const first = origin.split(',')[0]?.trim();
  return first || undefined;
}

export function isCorsAllowAll(): boolean {
  return process.env.CORS_ALLOW_ALL === 'true';
}

export function isCorsDisabled(): boolean {
  return process.env.CORS_DISABLED === 'true';
}

export function resolveCorsOrigins(): string[] {
  if (isCorsAllowAll()) return ['*'];

  const fromEnv = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const frontend = process.env.FRONTEND_URL?.trim();
  const defaults = ['http://localhost:3000', 'http://localhost:5173'];
  return [...new Set([...fromEnv, ...(frontend ? [frontend] : []), ...defaults])];
}

/** NestJS enableCors() — reads CORS_ORIGIN, CORS_CREDENTIALS, CORS_ALLOW_ALL from .env */
export function buildNestCorsOptions(): CorsOptions | false {
  if (isCorsDisabled()) {
    return false;
  }

  const credentials = process.env.CORS_CREDENTIALS === 'true';
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  const allowedHeaders = ['Content-Type', 'Authorization', 'X-Visitor-Id', 'Accept'];

  if (isCorsAllowAll()) {
    return {
      origin: true,
      credentials: false,
      methods,
      allowedHeaders,
      optionsSuccessStatus: 204,
    };
  }

  const origins = resolveCorsOrigins();
  if (origins.length === 0) {
    return { origin: true, credentials: false, methods, allowedHeaders, optionsSuccessStatus: 204 };
  }

  if (origins.length === 1) {
    return { origin: origins[0], credentials, methods, allowedHeaders, optionsSuccessStatus: 204 };
  }

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      const normalized = normalizeRequestOrigin(origin);
      if (!normalized) return callback(null, true);
      if (origins.includes(normalized)) return callback(null, normalized);
      console.warn('[cors] blocked origin:', origin);
      return callback(null, false);
    },
    credentials,
    methods,
    allowedHeaders,
    optionsSuccessStatus: 204,
  };
}

export function describeCorsMode(): string {
  if (isCorsDisabled()) {
    return 'disabled (CORS_DISABLED=true)';
  }
  if (isCorsAllowAll()) {
    return 'allow all origins (CORS_ALLOW_ALL=true)';
  }
  return `allowed origins: ${resolveCorsOrigins().join(', ')}`;
}
