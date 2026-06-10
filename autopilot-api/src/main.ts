import './websocket-polyfill';
import './crypto-polyfill';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const sessionSecret = process.env.SESSION_SECRET?.trim();
    if (!sessionSecret || sessionSecret === 'dev_session_secret') {
      console.error('FATAL: Set a strong SESSION_SECRET in production');
      process.exit(1);
    }
    if (process.env.DB_SYNCHRONIZE === 'true') {
      console.warn('WARNING: DB_SYNCHRONIZE=true in production — use migrations instead');
    }
    if (!process.env.API_PUBLIC_URL?.startsWith('https://')) {
      console.warn('WARNING: API_PUBLIC_URL should be a public HTTPS URL for social media publishing');
    }
  }

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
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
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  setupSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application listening on http://localhost:${port}`);
  console.log(`Documentation on http://localhost:${port}/documentation`);


}

bootstrap();
