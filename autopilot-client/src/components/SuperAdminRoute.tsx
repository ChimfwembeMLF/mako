import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { ShieldOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  redirectTo?: string;
}

/** Route guard for platform backoffice pages (/admin/system). */
export function SuperAdminRoute({ children, redirectTo = '/' }: Props) {
  const { isSuperAdmin, loading } = usePermissions();

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

/** Inline fallback when Super Admin access is denied */
export function SuperAdminDenied() {
  return (
    <div className="max-w-lg mx-auto p-8 text-center space-y-3">
      <ShieldOff className="h-10 w-10 mx-auto text-muted-foreground" />
      <h1 className="text-lg font-semibold">Backoffice access required</h1>
      <p className="text-sm text-muted-foreground">
        This area is restricted to platform Super Admins.
      </p>
    </div>
  );
}
