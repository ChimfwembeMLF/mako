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

export function shouldBypassSpa(pathname: string): boolean {
  return SPA_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Serve Vite assets + index.html for client routes only.
 * Registered in main.ts after Nest routes so OAuth/API paths are never swallowed.
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

  app.use(
    expressStatic(clientDist, {
      index: false,
      fallthrough: true,
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (shouldBypassSpa(req.path)) {
      next();
      return;
    }
    res.sendFile(indexHtml, (err) => {
      if (err) next(err);
    });
  });

  console.log('[client] SPA fallback active — /api, /uploads, /documentation, /admin bypass React');
}
