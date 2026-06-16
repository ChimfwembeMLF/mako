import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { tryServeSpaShell } from '../common/spa-fallback.util';

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

    if (tryServeSpaShell(req, res)) {
      return;
    }

    res.status(404).json({
      statusCode: 404,
      message: 'Not Found',
      path,
    });
  }
}
