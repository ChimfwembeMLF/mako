import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { resolveFrontendUrl } from '../common/env-urls.util';

/** Client routes that must never return JSON 404 from the API in split dev mode. */
const SPA_BROWSER_PATH =
  /^\/(auth\/callback|auth(?:\/|$)|dashboard|reset-password)(?:\/|$)/;

/**
 * Returns JSON 404 for unmatched API routes.
 * Browser navigations to SPA paths redirect to FRONTEND_URL (Vite in local dev).
 */
@Catch(NotFoundException)
export class SpaNotFoundFilter implements ExceptionFilter {
  catch(_exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{
      method?: string;
      path?: string;
      url?: string;
      get?: (name: string) => string | undefined;
    }>();
    const res = ctx.getResponse<Response>();
    const path = req.path ?? req.url?.split('?')[0] ?? '';

    if (
      req.method === 'GET' &&
      SPA_BROWSER_PATH.test(path) &&
      typeof res.redirect === 'function'
    ) {
      const frontend = resolveFrontendUrl().replace(/\/$/, '');
      const requestHost = req.get?.('host');
      let frontendHost: string | undefined;
      try {
        frontendHost = new URL(frontend).host;
      } catch {
        frontendHost = undefined;
      }

      if (frontendHost && requestHost && frontendHost !== requestHost) {
        const query = req.url?.includes('?')
          ? req.url.slice(req.url.indexOf('?'))
          : '';
        res.redirect(302, `${frontend}${path}${query}`);
        return;
      }
    }

    res.status(404).json({
      statusCode: 404,
      message: 'Not Found',
      path,
    });
  }
}
