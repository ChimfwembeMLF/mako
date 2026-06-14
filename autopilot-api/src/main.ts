import './polyfills';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import { configureExpressSession } from './config/session.config';
import { resolveApiPublicUrl } from './common/env-urls.util';
import * as passport from 'passport';

function normalizeLegacyEnv(): void {
  if (process.env.APP_URL && !process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = process.env.APP_URL;
  }
  if (process.env.API_URL && !process.env.API_PUBLIC_URL) {
    process.env.API_PUBLIC_URL = process.env.API_URL;
  }
}

async function bootstrap() {
  normalizeLegacyEnv();
  const logLevels = (process.env.LOG_LEVEL?.split(',') ?? ['error', 'warn', 'log']) as LogLevel[];
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
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

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://mako.tekreminnovations.com',
        'https://mako.tekreminnovations.com',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, origin);
      console.warn('Blocked CORS request from:', origin);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Id'],
    credentials: true,
  });

  await configureExpressSession(app, isProduction);

  app.useStaticAssets(join(process.cwd(), 'public'));

  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn(
      'WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for media uploads and publishing',
    );
  }

  // Legacy read-only: existing /uploads files until migrated via npm run storage:migrate
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

bootstrap();
