import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { resolveFrontendUrl } from '../common/env-urls.util';
import { tryServeSpaShell } from '../common/spa-fallback.util';

const OAUTH_REDIRECT_PATH =
  /^\/api\/v1\/(?:auth\/[^/]+\/redirect|social-accounts\/oauth\/[^/]+\/callback)(?:\/|\?|$)/;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const summary =
        exception instanceof Error
          ? exception.message
          : typeof exception === 'string'
            ? exception
            : 'Unhandled error';
      console.error(`[${httpStatus}] ${summary}`);
    }
    const errorMessages = exception?.response?.message;

    let message;
    if (!errorMessages) {
      message = exception instanceof Error ? exception.message : 'Internal Server Error';
    } else if (typeof errorMessages === 'string') {
      message = errorMessages;
    } else if (Array.isArray(errorMessages)) {
      message = errorMessages[0];
    } else if (typeof errorMessages === 'object') {
      message = errorMessages.message;
    }

    const path = httpAdapter.getRequestUrl(request);

    if (exception instanceof NotFoundException && tryServeSpaShell(request, response)) {
      return;
    }

    if (
      request.method === 'GET' &&
      OAUTH_REDIRECT_PATH.test(path.split('?')[0] ?? path)
    ) {
      const frontend = resolveFrontendUrl();
      const isPublisherCallback = path.includes('/social-accounts/oauth/');
      const errorText =
        httpStatus === HttpStatus.UNAUTHORIZED
          ? 'Sign-in session expired. Please try again.'
          : String(message || 'Authentication failed');
      const redirectBase = isPublisherCallback
        ? `${frontend}/publisher`
        : `${frontend}/auth/callback`;
      const redirectUrl = `${redirectBase}?error=${encodeURIComponent(errorText)}`;
      if (typeof response.redirect === 'function') {
        response.redirect(HttpStatus.FOUND, redirectUrl);
      } else {
        httpAdapter.reply(
          response,
          { success: false, statusCode: httpStatus, error: errorText },
          httpStatus,
        );
      }
      return;
    }

    const responseBody = {
      success: false,
      statusCode: httpStatus,
      error: message,
      timestamp: new Date().toISOString(),
      path,
    };

    httpAdapter.reply(response, responseBody, httpStatus);
  }
}
