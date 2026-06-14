import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import {
  CLIENT_STATIC_EXCLUDES,
  isClientDistAvailable,
  isServeClientEnabled,
  resolveClientDistPath,
} from './common/client-dist.util';

@Module({})
export class ClientStaticModule {
  static register(): DynamicModule {
    const enabled = isServeClientEnabled() && isClientDistAvailable();

    if (!enabled) {
      if (isServeClientEnabled() && !isClientDistAvailable()) {
        console.warn(
          '[client] SERVE_CLIENT enabled but no build found — run: yarn build:all (or yarn build:client && yarn copy:client)',
        );
      }
      return { module: ClientStaticModule, imports: [] };
    }

    const rootPath = resolveClientDistPath();
    console.log('[client] Serving React SPA from', rootPath);

    return {
      module: ClientStaticModule,
      imports: [
        ServeStaticModule.forRoot({
          rootPath,
          exclude: CLIENT_STATIC_EXCLUDES,
          serveStaticOptions: {
            index: 'index.html',
            fallthrough: false,
          },
        }),
      ],
    };
  }
}
