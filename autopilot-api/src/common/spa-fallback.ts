import type { Express, Request, Response } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import type { RequestHandler } from 'express';

/** Paths handled by Nest — must never receive the React index.html fallback. */
export const SPA_BYPASS_PREFIXES = [
  '/api',
  '/uploads',
  '/documentation',
  '/admin',
] as const;

/** Matches client-side routes only (excludes API/OAuth paths at registration time). */
export const SPA_CLIENT_ROUTE =
  /^(?!\/(?:api|uploads|documentation|admin)(?:\/|$)).+/;

export function shouldBypassSpa(pathname: string): boolean {
  return SPA_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Serve Vite assets + index.html for client routes only.
 * Must run after `await app.init()` so Nest API/OAuth routes register first.
 */
export function configureSpaFallback(
  app: NestExpressApplication,
  clientDist: string,
): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const expressStatic = require('express').static as (
    root: string,
    options?: { index?: boolean; fallthrough?: boolean },
  ) => RequestHandler;

  const indexHtml = join(clientDist, 'index.html');
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.use(
    expressStatic(clientDist, {
      index: false,
      fallthrough: true,
    }),
  );

  const sendIndex = (_req: Request, res: Response) => {
    res.sendFile(indexHtml);
  };

  // Regex routes never match /api/* — OAuth full-page navigations reach Nest
  expressApp.get(SPA_CLIENT_ROUTE, sendIndex);
  expressApp.head(SPA_CLIENT_ROUTE, sendIndex);

  // Root path
  expressApp.get('/', sendIndex);
  expressApp.head('/', (_req, res) => res.sendFile(indexHtml));

  console.log(
    '[client] SPA fallback active — /api, /uploads, /documentation, /admin never serve React',
  );
}
