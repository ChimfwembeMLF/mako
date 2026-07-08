import {
  UseInterceptors,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToInstance } from 'class-transformer';

export class SerializeInterceptor implements NestInterceptor {
  private logger = new Logger('SerializeInterceptor');
  constructor(private dto: any) {}

  intercept(context: ExecutionContext, handler: CallHandler): Observable<any> {
    // Run something before a request is handled by the request handler

    return handler.handle().pipe(
      map((data: any) => {
        // Run something before the response is sent out

        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
        });
      }),
    );
  }
}
