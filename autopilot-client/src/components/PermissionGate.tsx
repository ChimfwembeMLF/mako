import React, { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/lib/permissions';
import { ShieldOff } from 'lucide-react';

interface Props {
  /** Require ALL of these permissions */
  require?: PermissionKey | PermissionKey[];
  /** Require AT LEAST ONE of these permissions */
  requireAny?: PermissionKey | PermissionKey[];
  /** Require platform Super Admin (backoffice) */
  superAdmin?: boolean;
  /** What to render when permission is denied. Default: nothing. Pass `true` for built-in message. */
  fallback?: ReactNode | true;
  children: ReactNode;
}

/**
 * PermissionGate — conditionally renders children based on the current user's permissions.
 *
 * Usage:
 *   <PermissionGate require="content.approve">
 *     <ApproveButton />
 *   </PermissionGate>
 *
 *   <PermissionGate requireAny={['content.approve','content.publish']} fallback={true}>
 *     <PublishPanel />
 *   </PermissionGate>
 */
export function PermissionGate({ require, requireAny, superAdmin, fallback, children }: Props) {
  const { can, canAll, canAny, isSuperAdmin, loading } = usePermissions();

  if (loading) return null;

  let allowed = true;

  if (superAdmin) {
    allowed = isSuperAdmin;
  }

  if (allowed && require) {
    const perms = Array.isArray(require) ? require : [require];
    allowed = canAll(...perms);
  }

  if (allowed && requireAny) {
    const perms = Array.isArray(requireAny) ? requireAny : [requireAny];
    allowed = canAny(...perms);
  }

  if (!allowed) {
    if (!fallback) return null;
    if (fallback === true) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md border border-dashed">
          <ShieldOff className="h-4 w-4 shrink-0" />
          <span>You don't have permission to access this feature.</span>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * useGate — imperative version for use inside event handlers.
 * Returns a function that throws if the user lacks the given permission.
 */
export function useGate() {
  const { can } = usePermissions();
  return (permission: PermissionKey, message?: string) => {
    if (!can(permission)) {
      throw new Error(message ?? `Permission denied: ${permission}`);
    }
  };
}
