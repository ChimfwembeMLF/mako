import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { api } from '../lib/api';

/** Permission keys used by mobile (match web `P.*` and seeded RBAC). */
export const PERM = {
  contentView: 'content.view',
  contentPublish: 'content.publish',
  contentCreate: 'content.create',
  contentEdit: 'content.edit',
  repliesCreate: 'replies.create',
  repliesManageRules: 'replies.manage_rules',
  mediaView: 'media.view',
  templatesView: 'templates.view',
  analyticsView: 'analytics.view',
  settingsView: 'settings.view',
  settingsBrandBrain: 'settings.brand_brain',
  teamView: 'team.view',
  approvalsView: 'approvals.view',
  approvalsReview: 'approvals.review',
  leadsView: 'leads.view',
  leadsEmail: 'leads.email',
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
  const isSuperAdmin = Boolean(query.data?.isSuperAdmin);
  const can = (key: string) => isSuperAdmin || permissions.includes(key);
  const canAny = (...keys: string[]) => keys.some((k) => can(k));

  return {
    ...query,
    roleName: query.data?.roleName ?? null,
    isSuperAdmin,
    can,
    canAny,
    canPublish: can(PERM.contentPublish),
    canCreate: can(PERM.contentCreate),
    canEdit: can(PERM.contentEdit),
    canReply: can(PERM.repliesCreate),
    canViewSettings: can(PERM.settingsView),
    canBrandBrain: can(PERM.settingsBrandBrain),
    canViewTeam: can(PERM.teamView),
    canViewApprovals: can(PERM.approvalsView),
    canReviewApprovals: can(PERM.approvalsReview),
    canViewMedia: can(PERM.mediaView),
    canViewTemplates: can(PERM.templatesView),
    canViewAnalytics: can(PERM.analyticsView),
    canViewLeads: can(PERM.leadsView),
    canViewMail: can(PERM.leadsEmail),
    canManageAutoReply: can(PERM.repliesManageRules),
    /** True once we know permissions (or failed closed with empty set). */
    ready: !query.isLoading && (query.isFetched || !effectiveTenant || !userId),
  };
}
