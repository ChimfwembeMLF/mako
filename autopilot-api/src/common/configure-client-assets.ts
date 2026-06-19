import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

/** Vite JS/CSS/icons only — no catch-all; unmatched routes fall through to Nest. */
export function configureClientAssets(
  app: NestExpressApplication,
  clientDist: string,
): void {
  app.useStaticAssets(join(clientDist, 'assets'), {
    prefix: '/assets',
    maxAge: 31_536_000,
    index: false,
  });
  app.useStaticAssets(join(clientDist, 'icons'), {
    prefix: '/icons',
    maxAge: 31_536_000,
    index: false,
  });
  app.useStaticAssets(clientDist, {
    prefix: '/',
    index: 'index.html',
    fallthrough: true,
  });
  console.log(
    '[client] Static assets from',
    clientDist,
    '(index.html at /; SPA routes via 404 filter)',
  );
}
