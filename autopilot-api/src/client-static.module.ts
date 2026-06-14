import { DynamicModule, Module } from '@nestjs/common';
import {
  isClientDistAvailable,
  isServeClientEnabled,
  resolveClientDistPath,
} from './common/client-dist.util';

/** SPA static files are registered in main.ts (configureSpaFallback) so /api/* OAuth is never swallowed. */
@Module({})
export class ClientStaticModule {
  static register(): DynamicModule {
    const wantsClient = isServeClientEnabled();
    const hasBuild = isClientDistAvailable();

    if (wantsClient && hasBuild) {
      console.log('[client] Build found at', resolveClientDistPath(), '(served from main.ts)');
    } else if (wantsClient && !hasBuild) {
      console.warn(
        '[client] SERVE_CLIENT enabled but no build found — run: yarn build:all (or yarn build:client && yarn copy:client)',
      );
    }

    return { module: ClientStaticModule, imports: [] };
  }
}
