import type { FindOptionsWhere } from 'typeorm';
import { IsNull } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';

/** Build a TypeORM where clause scoped to tenant and optional workspace. */
export function scopeWhere<
  T extends { tenantId: string; workspaceId?: string | null },
>(tenantId: string, workspaceId?: string): FindOptionsWhere<T> {
  const where = { tenantId } as FindOptionsWhere<T>;
  if (workspaceId) {
    (where as { workspaceId?: string }).workspaceId = workspaceId;
  }
  return where;
}

/**
 * Workspace-aware find `where` that also includes tenant-wide rows (workspaceId IS NULL).
 * Use when listing resources that may predate workspace assignment.
 */
export function scopeWhereIncludingTenantWide<
  T extends { tenantId: string; workspaceId?: string | null },
>(
  tenantId: string,
  workspaceId: string | undefined,
  extra: FindOptionsWhere<T> = {},
): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
  if (!workspaceId) {
    return { tenantId, ...extra } as FindOptionsWhere<T>;
  }
  return [
    { tenantId, workspaceId, ...extra } as FindOptionsWhere<T>,
    { tenantId, workspaceId: IsNull(), ...extra } as FindOptionsWhere<T>,
  ];
}

/** Apply workspace filter to a query builder (includes tenant-wide NULL rows). */
export function applyWorkspaceScope(
  qb: SelectQueryBuilder<unknown>,
  alias: string,
  workspaceId?: string,
): void {
  if (!workspaceId) return;
  qb.andWhere(
    `(${alias}.workspaceId = :workspaceId OR ${alias}.workspaceId IS NULL)`,
    { workspaceId },
  );
}
