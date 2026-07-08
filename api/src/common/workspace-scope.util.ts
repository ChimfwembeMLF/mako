import type { FindOptionsWhere } from 'typeorm';

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
