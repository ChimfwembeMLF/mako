import './polyfills';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import { resolveApiPublicUrl } from './common/env-urls.util';
import type { RequestHandler } from 'express';
import type { SessionOptions } from 'express-session';
import * as passport from 'passport';

// Same CJS pattern as passport — avoids broken default import at runtime under PM2
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expressSession = require('express-session') as (options: SessionOptions) => RequestHandler;

function resolveCorsOrigins(): string[] {
  return process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://mako.tekreminnovations.com',
        'https://mako.tekreminnovations.com',
      ];
}

function buildCorsOptions(): import('@nestjs/common/interfaces/external/cors-options.interface').CorsOptions {
  const corsOrigins = resolveCorsOrigins();
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, origin);
      console.warn('[cors] blocked origin:', origin);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Id', 'Accept'],
    optionsSuccessStatus: 204,
  };
}

function normalizeLegacyEnv(): void {
  if (process.env.APP_URL && !process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = process.env.APP_URL;
  }
  if (process.env.API_URL && !process.env.API_PUBLIC_URL) {
    process.env.API_PUBLIC_URL = process.env.API_URL;
  }
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
      secure: isProduction,
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
      console.log(`[session] Redis store active (${host}:${port}, db ${database})`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[session] Redis unavailable (${message}); using MemoryStore`);
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
  console.log('[boot] Mako API starting (session-fix-v3, cors-v5)');
  console.log(`[cors] allowed origins: ${resolveCorsOrigins().join(', ')}`);

  const logLevels = (process.env.LOG_LEVEL?.split(',') ?? ['error', 'warn', 'log']) as LogLevel[];
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
    cors: buildCorsOptions(),
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.set('trust proxy', 1);

    const sessionSecret = process.env.SESSION_SECRET?.trim();
    if (!sessionSecret || sessionSecret === 'dev_session_secret') {
      console.error('FATAL: Set a strong SESSION_SECRET in production');
      process.exit(1);
    }
    if (process.env.DB_SYNCHRONIZE === 'true') {
      console.warn('WARNING: DB_SYNCHRONIZE=true in production — use migrations instead (npm run migrations:run)');
    }
    const apiPublicUrl = resolveApiPublicUrl();
    if (!apiPublicUrl.startsWith('https://')) {
      console.warn('WARNING: API_PUBLIC_URL should be a public HTTPS URL for social media publishing');
    }
  }

  await configureExpressSession(app, isProduction);

  app.useStaticAssets(join(process.cwd(), 'public'));

  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
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
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
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
