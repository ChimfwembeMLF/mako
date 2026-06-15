import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import {
  isClientDistAvailable,
  isServeClientEnabled,
  resolveClientDistPath,
  shouldBypassSpa,
} from '../common/client-dist.util';

/**
 * Serves React index.html only when Nest has no route (client-side routes).
 * API/OAuth paths (/api/*) always get JSON 404 — never the SPA shell.
 */
@Catch(NotFoundException)
export class SpaNotFoundFilter implements ExceptionFilter {
  catch(_exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{ method?: string; path?: string; url?: string }>();
    const res = ctx.getResponse<Response>();
    const path = req.path ?? req.url?.split('?')[0] ?? '';

    const serveClient = isServeClientEnabled() && isClientDistAvailable();
    const isGetOrHead = req.method === 'GET' || req.method === 'HEAD';

    if (serveClient && isGetOrHead && !shouldBypassSpa(path)) {
      res.sendFile(join(resolveClientDistPath(), 'index.html'));
      return;
    }

    res.status(404).json({
      statusCode: 404,
      message: 'Not Found',
      path,
    });
  }
}
