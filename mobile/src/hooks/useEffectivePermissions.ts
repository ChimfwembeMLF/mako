import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { api } from '../lib/api';

/** Permission keys used by mobile core actions (match seeded RBAC). */
export const PERM = {
  contentPublish: 'content.publish',
  repliesCreate: 'replies.create',
} as const;

export function useEffectivePermissions() {
  const { session } = useAuth();
  const { tenantId, activeWorkspace } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId || null;
  const userId =
    session?.userId && session.userId !== 'unknown' ? session.userId : null;

  const query = useQuery({
    queryKey: ['effective-permissions', effectiveTenant, userId],
    enabled: Boolean(effectiveTenant && userId),
    queryFn: () => api.getEffectivePermissions(effectiveTenant!, userId!),
    staleTime: 60_000,
  });

  const permissions = query.data?.permissions ?? [];
  const can = (key: string) =>
    Boolean(query.data?.isSuperAdmin) || permissions.includes(key);

  return {
    ...query,
    roleName: query.data?.roleName ?? null,
    can,
    canPublish: can(PERM.contentPublish),
    canReply: can(PERM.repliesCreate),
    /** True once we know permissions (or failed closed with empty set). */
    ready: !query.isLoading && (query.isFetched || !effectiveTenant || !userId),
  };
}
