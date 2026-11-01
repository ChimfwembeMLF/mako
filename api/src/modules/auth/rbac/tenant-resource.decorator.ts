import { SetMetadata } from '@nestjs/common';
import type { EntityTarget, ObjectLiteral } from 'typeorm';

export const TENANT_RESOURCE_KEY = 'tenantResource';

export type TenantResourceOptions = {
  entity: EntityTarget<ObjectLiteral>;
  param: string;
  field: string;
};

/**
 * Marks a route's record as tenant-owned, for routes that take a record id rather
 * than a tenant id. TenantScopeInterceptor then applies its membership rule to the
 * tenant the record belongs to.
 */
export const TenantResource = (
  entity: EntityTarget<ObjectLiteral>,
  { param = 'id', field = 'id' }: Partial<Omit<TenantResourceOptions, 'entity'>> = {},
) => SetMetadata(TENANT_RESOURCE_KEY, { entity, param, field });
