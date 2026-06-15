import { useCallback, useEffect, useState } from 'react';
import { rbacApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isSuperAdminRole } from '@/lib/roles';
import { useTenant } from '@/hooks/useTenant';
import type { PermissionKey } from '@/lib/permissions';
import { P } from '@/lib/permissions';

interface PermissionState {
  granted: Set<string>;
  isSuperAdmin: boolean;
  roleName: string | null;
  loading: boolean;
}

let _cache: { tenantId: string; userId: string; state: PermissionState } | null = null;

export function usePermissions() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [state, setState] = useState<PermissionState>({
    granted: new Set(),
    isSuperAdmin: false,
    roleName: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!user || !tenant) {
      setState({ granted: new Set(), isSuperAdmin: false, roleName: null, loading: false });
      return;
    }
    if (_cache?.tenantId === tenant.id && _cache?.userId === user.id) {
      setState(_cache.state);
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const result = await rbacApi.getEffectivePermissions(tenant.id, user.id);
      const fromApi = result.isSuperAdmin ?? result.isSystemAdmin ?? false;
      const next: PermissionState = {
        granted: new Set(result.permissions ?? []),
        isSuperAdmin: fromApi || isSuperAdminRole(user.role),
        roleName: result.roleName ?? null,
        loading: false,
      };
      _cache = { tenantId: tenant.id, userId: user.id, state: next };
      setState(next);
    } catch {
      setState({
        granted: new Set(),
        isSuperAdmin: isSuperAdminRole(user.role),
        roleName: null,
        loading: false,
      });
    }
  }, [user, tenant]);

  useEffect(() => { load(); }, [load]);

  const can = useCallback(
    (permission: PermissionKey | string): boolean => {
      return state.granted.has(permission);
    },
    [state.granted],
  );

  const canAll = useCallback(
    (...permissions: string[]): boolean => permissions.every((p) => can(p)),
    [can],
  );

  const canAny = useCallback(
    (...permissions: string[]): boolean => permissions.some((p) => can(p)),
    [can],
  );

  const canBackoffice = useCallback(
    (): boolean => state.isSuperAdmin && can(P.admin.super),
    [state.isSuperAdmin, can],
  );

  const invalidate = useCallback(() => { _cache = null; load(); }, [load]);

  /** @deprecated use isSuperAdmin */
  const isSystemAdmin = state.isSuperAdmin;

  return {
    can,
    canAll,
    canAny,
    canBackoffice,
    isSuperAdmin: state.isSuperAdmin,
    isSystemAdmin,
    roleName: state.roleName,
    loading: state.loading,
    invalidate,
  };
}

export function invalidatePermissionCache() { _cache = null; }
