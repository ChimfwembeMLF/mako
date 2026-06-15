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

    if (wantsClient && hasBuild) {
      console.log('[client] Build found at', resolveClientDistPath(), '(served from main.ts)');
    } else if (wantsClient && !hasBuild) {
      console.warn(
        '[client] SERVE_CLIENT enabled but no build found — run: yarn build:all (from autopilot-api/)',
      );
    }

    return { module: ClientStaticModule, imports: [] };
  }
}
