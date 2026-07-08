import './polyfills';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import {
  resolveApiPublicUrl,
  assertProductionUrls,
  normalizeProductionUrls,
} from './common/env-urls.util';
import { buildNestCorsOptions, describeCorsMode } from './common/cors.util';
import { warnProductionOAuthEnv } from './common/oauth-env.util';
import type { RequestHandler } from 'express';
import type { SessionOptions } from 'express-session';
import * as passport from 'passport';
import helmet from 'helmet';

// Load .env before CORS/session read process.env (ConfigModule loads later).
function loadEnvFiles(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as typeof import('dotenv');
  const nodeEnv = process.env.NODE_ENV || 'development';
  for (const file of [`.env.${nodeEnv}`, '.env']) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) {
      dotenv.config({ path });
    }
  }
}

loadEnvFiles();
normalizeLegacyEnv();

// Same CJS pattern as passport — avoids broken default import at runtime under PM2
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expressSession = require('express-session') as (
  options: SessionOptions,
) => RequestHandler;

function normalizeLegacyEnv(): void {
  if (process.env.APP_URL && !process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = process.env.APP_URL;
  }
  if (process.env.API_URL && !process.env.API_PUBLIC_URL) {
    process.env.API_PUBLIC_URL = process.env.API_URL;
  }

  normalizeProductionUrls();

  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || '4000';
    const devOrigin = `http://localhost:${port}`;
    if (!process.env.FRONTEND_URL?.trim()) {
      process.env.FRONTEND_URL = devOrigin;
    }
    if (!process.env.API_PUBLIC_URL?.trim()) {
      process.env.API_PUBLIC_URL = devOrigin;
    }
    if (!process.env.CLIENT_URL?.trim()) {
      process.env.CLIENT_URL = devOrigin;
    }
    for (const key of [
      'FRONTEND_URL',
      'CLIENT_URL',
      'API_PUBLIC_URL',
      'APP_URL',
    ] as const) {
      if (process.env[key]?.includes('localhost:3000')) {
        process.env[key] = devOrigin;
      }
    }
  }
}

function resolveSessionCookieSecure(isProduction: boolean): boolean {
  const raw = process.env.SESSION_SECURE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return isProduction;
}

async function configureExpressSession(
  app: NestExpressApplication,
  isProduction: boolean,
): Promise<void> {
  const sessionSecret = process.env.SESSION_SECRET || 'dev_session_secret';
  const maxAgeMs = Number(process.env.SESSION_EXPIRY || 86400) * 1000;

  const sessionOptions: SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'mako.sid',
    cookie: {
      maxAge: maxAgeMs,
      httpOnly: true,
      sameSite: 'lax',
      secure: resolveSessionCookieSecure(isProduction),
    },
  };

  const useRedis = process.env.SESSION_STORE !== 'memory';
  if (useRedis) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('redis');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RedisStore } = require('connect-redis');

      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT || 6379);
      const password = process.env.REDIS_PASSWORD?.trim() || undefined;
      const database = Number(process.env.REDIS_DB || 0);

      const client = createClient({
        socket: { host, port },
        password,
        database,
      });
      client.on('error', (err: Error) =>
        console.error('[session] Redis client error:', err.message),
      );
      await client.connect();

      sessionOptions.store = new RedisStore({
        client,
        prefix: 'mako:sess:',
      });
      app.use(expressSession(sessionOptions));
      console.log(
        `[session] Redis store active (${host}:${port}, db ${database})`,
      );
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[session] Redis unavailable (${message}); using MemoryStore`,
      );
      if (isProduction) {
        console.warn(
          '[session] PM2 cluster + MemoryStore breaks OAuth — use Redis or set instances:1',
        );
      }
    }
  }

  app.use(expressSession(sessionOptions));
  console.log('[session] MemoryStore active');
}

async function bootstrap() {
  normalizeLegacyEnv();
  warnProductionOAuthEnv();

  const isProduction = process.env.NODE_ENV === 'production';

  console.log('[boot] Mako API starting (API-only mode)');
  console.log('[cors]', describeCorsMode());

  const logLevels = (process.env.LOG_LEVEL?.split(',') ?? [
    'error',
    'warn',
    'log',
  ]) as LogLevel[];
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
  });

  const corsOptions = buildNestCorsOptions();
  if (corsOptions) {
    app.enableCors(corsOptions);
  }

  if (isProduction) {
    assertProductionUrls();
    app.set('trust proxy', 1);

    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );

    const sessionSecret = process.env.SESSION_SECRET?.trim();
    if (!sessionSecret || sessionSecret === 'dev_session_secret') {
      console.error('FATAL: Set a strong SESSION_SECRET in production');
      process.exit(1);
    }
    if (process.env.DB_SYNCHRONIZE === 'true') {
      console.warn(
        'WARNING: DB_SYNCHRONIZE=true in production — use migrations instead (npm run migrations:run)',
      );
    }
    const apiPublicUrl = resolveApiPublicUrl();
    if (!apiPublicUrl.startsWith('https://')) {
      console.warn(
        'WARNING: API_PUBLIC_URL should be a public HTTPS URL for social media publishing',
      );
    }
  }

  await configureExpressSession(app, isProduction);

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    next();
  });

  app.useStaticAssets(join(process.cwd(), 'public'));

  if (
    !process.env.SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    console.warn(
      'WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for media uploads and publishing',
    );
  }

  const uploadsDir = join(process.cwd(), 'uploads');
  if (existsSync(uploadsDir)) {
    app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
  }



  app.use(passport.initialize());
  app.use(passport.session());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  setupSwagger(app);

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application listening on http://0.0.0.0:${port}`);
  console.log(`Documentation on http://localhost:${port}/documentation`);
  console.log(`Bull Board on http://localhost:${port}/admin/queues`);
}

bootstrap().catch((err) => {
  console.error('[boot] Fatal startup error:', err);
  process.exit(1);
});
