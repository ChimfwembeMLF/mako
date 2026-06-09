import './crypto-polyfill';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'public'));

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
  console.log(`OAuth test page: http://localhost:${port}/oauth-test.html`);
  console.log(`OAuth test page: http://localhost:${port}/social-oauth-test.html`);

}

bootstrap();
