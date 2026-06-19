import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ViteDevServer } from 'vite';
import { join } from 'path';
import { shouldBypassSpa } from './client-dist.util';

/** Vite HMR in development — registered early so API routes still hit Nest first. */
export async function configureViteDev(
  app: NestExpressApplication,
): Promise<ViteDevServer> {
  const clientRoot = join(process.cwd(), 'resources', 'client');
  const { createServer } = await import('vite');

  const vite = await createServer({
    root: clientRoot,
    configFile: join(clientRoot, 'vite.config.ts'),
    server: {
      middlewareMode: true,
      hmr: { server: app.getHttpServer() },
    },
    appType: 'spa',
  });

  app.use((req, res, next) => {
    if (shouldBypassSpa(req.path)) {
      return next();
    }
    return vite.middlewares(req, res, next);
  });

  const port = process.env.PORT || 4000;
  console.log(
    '[client] Vite dev middleware active — open http://localhost:' + port,
  );
  return vite;
}
