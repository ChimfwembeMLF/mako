import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { from, Observable, switchMap } from 'rxjs';
import { DataSource } from 'typeorm';
import { RbacService } from './rbac.service';
import {
  TENANT_RESOURCE_KEY,
  TenantResourceOptions,
} from './tenant-resource.decorator';

/**
 * Global rule: a logged-in request that names a tenant, or a record marked with
 * @TenantResource, must come from a member of that tenant.
 * Runs after route guards, so public routes (no req.user) pass through untouched.
 * Multipart bodies aren't parsed yet at this point, so upload routes check for themselves.
 */
@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  constructor(
    private readonly rbac: RbacService,
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) return next.handle();

    return from(this.assertAccess(String(userId), context, req)).pipe(
      switchMap(() => next.handle()),
    );
  }

  private async assertAccess(
    userId: string,
    context: ExecutionContext,
    req: {
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    },
  ) {
    const tenantIds = new Set<unknown>(
      [req.params?.tenantId, req.query?.tenantId, req.body?.tenantId].flat(),
    );
    const resource = this.reflector.getAllAndOverride<TenantResourceOptions>(
      TENANT_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (resource) tenantIds.add(await this.resourceTenant(resource, req.params));

    for (const tenantId of tenantIds) {
      if (typeof tenantId !== 'string' || !tenantId) continue;
      if (!isUUID(tenantId) || !(await this.rbac.canAccessTenant(userId, tenantId))) {
        throw new ForbiddenException('You are not a member of this workspace');
      }
    }
  }

  /** Unknown records fall through so the route answers with its usual 404. */
  private async resourceTenant(
    { entity, param, field }: TenantResourceOptions,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const id = params[param];
    if (typeof id !== 'string' || !isUUID(id)) return undefined;
    const record = await this.dataSource
      .getRepository(entity)
      .findOne({ where: { [field]: id } });
    return record?.tenantId;
  }
}
