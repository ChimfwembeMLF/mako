import './polyfills';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import type { Request, Response } from 'express';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const logLevels = (process.env.LOG_LEVEL?.split(',') ?? ['error', 'warn', 'log']) as LogLevel[];
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
  });
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const sessionSecret = process.env.SESSION_SECRET?.trim();
    if (!sessionSecret || sessionSecret === 'dev_session_secret') {
      console.error('FATAL: Set a strong SESSION_SECRET in production');
      process.exit(1);
    }
    if (process.env.DB_SYNCHRONIZE === 'true') {
      console.warn('WARNING: DB_SYNCHRONIZE=true in production — use migrations instead (npm run migrations:run)');
    }
    if (!process.env.API_PUBLIC_URL?.startsWith('https://')) {
      console.warn('WARNING: API_PUBLIC_URL should be a public HTTPS URL for social media publishing');
    }
  }

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000', 'http://localhost:5173','http://mako.tekreminnovations.com', 'https://mako.tekreminnovations.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.getHttpAdapter().get('/api/v1/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      port: process.env.PORT,
      service: 'Mako API',
      version: '1.0.0'
    });
  });
  
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

  // Enable express-session so Passport can store OAuth2 `state` in session
  const sessionSecret = process.env.SESSION_SECRET || 'dev_session_secret';
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
    }),
  );

  // Initialize passport and session support for OAuth state handling
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
