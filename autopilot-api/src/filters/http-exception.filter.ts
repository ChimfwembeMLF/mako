import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

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
      message = 'Internal Server Error';
    } else {
      if (typeof errorMessages === 'string') {
        message = errorMessages;
      } else if (Array.isArray(errorMessages)) {
        message = errorMessages[0];
      } else if (typeof errorMessages === 'object') {
        message = errorMessages.message;
      }
    }

    const responseBody = {
      success: false,
      statusCode: httpStatus,
      error: message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
