import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Returns JSON 404 for all unmatched routes.
 * The React SPA is served by a separate Nginx container.
 */
@Catch(NotFoundException)
export class SpaNotFoundFilter implements ExceptionFilter {
  catch(_exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{
      method?: string;
      path?: string;
      url?: string;
    }>();
    const res = ctx.getResponse<Response>();
    const path = req.path ?? req.url?.split('?')[0] ?? '';

    res.status(404).json({
      statusCode: 404,
      message: 'Not Found',
      path,
    });
  }
}
