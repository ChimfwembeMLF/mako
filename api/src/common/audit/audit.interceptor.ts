import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditLogsService } from '../../modules/audit_logs/audit_logs.service';
import { AuditContextService } from './audit-context.service';
import {
  NIL_UUID,
  buildRequestAction,
  resourceTypeFromPath,
  shouldSkipAudit,
} from './audit-request.util';
import { SKIP_AUDIT_KEY } from './skip-audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditLogs: AuditLogsService,
    private readonly context: AuditContextService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const started = Date.now();

    const skipDecorator = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const path = req.originalUrl || req.url || '';
    if (skipDecorator || shouldSkipAudit(path, req.method)) {
      return next.handle();
    }

    const log = (statusCode: number, errorMessage?: string) => {
      void this.writeLog(req, res, started, statusCode, errorMessage);
    };

    return next.handle().pipe(
      tap(() => log(res.statusCode || 200)),
      catchError((err) => {
        const status =
          typeof err?.status === 'number'
            ? err.status
            : typeof err?.getStatus === 'function'
            ? err.getStatus()
            : 500;
        log(status, err?.message || String(err));
        return throwError(() => err);
      }),
    );
  }

  private async writeLog(
    req: Request,
    res: Response,
    started: number,
    statusCode: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const path = req.originalUrl || req.url || '';
      const ctx = await this.context.resolve(req);
      const durationMs = Date.now() - started;
      const resourceId =
        typeof req.params?.id === 'string' && req.params.id.length === 36
          ? req.params.id
          : NIL_UUID;

      await this.auditLogs.logRequest({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: buildRequestAction(req.method, path),
        resourceType: resourceTypeFromPath(path),
        resourceId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          method: req.method,
          path: path.split('?')[0],
          statusCode,
          durationMs,
          query: this.sanitizeQuery(req.query),
          error: errorMessage,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private sanitizeQuery(query: Request['query']): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query ?? {})) {
      if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token')
      ) {
        out[key] = '[redacted]';
      } else {
        out[key] = value;
      }
    }
    return out;
  }
}
