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
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';
import { Workspaces } from '../../workspaces/entities/workspaces.entity';

/**
 * Global rule: a logged-in request that names a tenant, or a record marked with
 * @TenantResource, must come from a member of that tenant. A workspaceId must
 * belong to that tenant, and a route marked @RequirePermission needs the caller's
 * role to grant that permission (the tenant owner always passes).
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

    // Without a tenant these list every tenant's records.
    const named = [...tenantIds].some(Boolean);
    if (resource && !named && context.getHandler().name === 'findAll') {
      if (!(await this.rbac.isSuperAdmin(userId))) {
        throw new ForbiddenException('tenantId is required');
      }
    }

    // A workspace id must sit inside the tenant being accessed; a request that
    // names only a workspace is checked against the workspace's tenant.
    const workspaceIds = [
      req.params?.workspaceId,
      req.query?.workspaceId,
      req.body?.workspaceId,
    ].filter((w): w is string => typeof w === 'string' && w.length > 0);
    for (const workspaceId of workspaceIds) {
      const workspaceTenant = isUUID(workspaceId)
        ? await this.workspaceTenant(workspaceId)
        : undefined;
      if (!workspaceTenant) {
        throw new ForbiddenException('Workspace not found');
      }
      const namedTenants = [...tenantIds].filter(Boolean);
      if (namedTenants.length && !namedTenants.includes(workspaceTenant)) {
        throw new ForbiddenException('Workspace does not belong to this organization');
      }
      tenantIds.add(workspaceTenant);
    }

    const checked: string[] = [];
    for (const tenantId of tenantIds) {
      if (typeof tenantId !== 'string' || !tenantId) continue;
      if (!isUUID(tenantId) || !(await this.rbac.canAccessTenant(userId, tenantId))) {
        throw new ForbiddenException('You are not a member of this workspace');
      }
      checked.push(tenantId);
    }

    const permission = this.reflector.getAllAndOverride<string>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return;
    if (await this.rbac.isSuperAdmin(userId)) return;
    if (!checked.length) {
      throw new ForbiddenException('tenantId is required');
    }
    for (const tenantId of checked) {
      if (await this.rbac.isTenantOwner(userId, tenantId)) continue;
      if (!(await this.rbac.hasPermission(userId, tenantId, permission))) {
        throw new ForbiddenException(
          `Your role does not allow this (${permission})`,
        );
      }
    }
  }

  private async workspaceTenant(id: string): Promise<string | undefined> {
    const ws = await this.dataSource
      .getRepository(Workspaces)
      .findOne({ where: { id }, select: { id: true, tenantId: true } });
    return ws?.tenantId;
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
