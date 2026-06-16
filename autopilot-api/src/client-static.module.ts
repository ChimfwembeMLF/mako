import { DynamicModule, Module } from '@nestjs/common';
import {
  isClientDistAvailable,
  isServeClientEnabled,
  resolveClientDistPath,
} from './common/client-dist.util';

/** Client build check; assets + SPA 404 filter are wired in main.ts / SpaNotFoundFilter. */
@Module({})
export class ClientStaticModule {
  static register(): DynamicModule {
    const wantsClient = isServeClientEnabled();
    const hasBuild = isClientDistAvailable();
    const isProduction = process.env.NODE_ENV === 'production';

    if (wantsClient && hasBuild && isProduction) {
      console.log('[client] Build found at', resolveClientDistPath(), '(served from main.ts)');
    } else if (wantsClient && !hasBuild && isProduction) {
      console.warn(
        '[client] SERVE_CLIENT enabled but no build found — run: yarn build (from autopilot-api/)',
      );
    } else if (wantsClient && !isProduction) {
      console.log('[client] Dev mode — Vite middleware serves React from resources/client/');
    }

    return { module: ClientStaticModule, imports: [] };
  }
}
