import { RedisStore } from 'connect-redis';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RequestHandler } from 'express';
import type { SessionOptions } from 'express-session';
import { createClient, type RedisClientType } from 'redis';

let redisSessionClient: RedisClientType | null = null;

/** CJS-safe loader — avoids `import default` breaking at runtime under PM2. */
function expressSession(): (options: SessionOptions) => RequestHandler {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require('express-session') as
    | ((options: SessionOptions) => RequestHandler)
    | { default: (options: SessionOptions) => RequestHandler };

  if (typeof loaded === 'function') {
    return loaded;
  }
  if (typeof loaded?.default === 'function') {
    return loaded.default;
  }

  throw new TypeError('express-session middleware could not be loaded');
}

export async function configureExpressSession(
  app: NestExpressApplication,
  isProduction: boolean,
): Promise<void> {
  const session = expressSession();
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
      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT || 6379);
      const password = process.env.REDIS_PASSWORD?.trim() || undefined;
      const database = Number(process.env.REDIS_DB || 0);

      redisSessionClient = createClient({
        socket: { host, port },
        password,
        database,
      });
      redisSessionClient.on('error', (err) =>
        console.error('[session] Redis client error:', err.message),
      );
      await redisSessionClient.connect();

      sessionOptions.store = new RedisStore({
        client: redisSessionClient,
        prefix: 'mako:sess:',
      });
      app.use(session(sessionOptions));
      console.log(`Session store: Redis (${host}:${port}, db ${database})`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[session] Redis unavailable (${message}); using MemoryStore`);
      if (isProduction) {
        console.warn(
          'WARNING: PM2 cluster + MemoryStore breaks OAuth — set REDIS_HOST or SESSION_STORE=memory with instances:1',
        );
      }
    }
  }

  app.use(session(sessionOptions));
  console.log('Session store: MemoryStore');
}
