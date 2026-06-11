/**
 * Canonical permission keys — must match the seeded `permissions` table.
 * Import P.content.view instead of magic strings everywhere.
 */
export const P = {
  content: {
    view:    'content.view',
    create:  'content.create',
    edit:    'content.edit',
    delete:  'content.delete',
    approve: 'content.approve',
    publish: 'content.publish',
  },
  leads: {
    view:      'leads.view',
    email:     'leads.email',
    emailBulk: 'leads.email_bulk',
    classify:  'leads.classify',
    delete:    'leads.delete',
    export:    'leads.export',
  },
  media: {
    view:   'media.view',
    upload: 'media.upload',
    delete: 'media.delete',
  },
  templates: {
    view:     'templates.view',
    create:   'templates.create',
    edit:     'templates.edit',
    delete:   'templates.delete',
    activate: 'templates.activate',
  },
  replies: {
    view:        'replies.view',
    create:      'replies.create',
    manageRules: 'replies.manage_rules',
  },
  analytics: { view: 'analytics.view' },
  team: {
    view:              'team.view',
    invite:            'team.invite',
    remove:            'team.remove',
    assignRoles:       'team.assign_roles',
    assignPermissions: 'team.assign_permissions',
  },
  settings: {
    view:       'settings.view',
    billing:    'settings.billing',
    brandBrain: 'settings.brand_brain',
  },
  approvals: {
    view:   'approvals.view',
    review: 'approvals.review',
  },
  audit: { view: 'audit.view' },
  chatbot: {
    view:   'chatbot.view',
    use:    'chatbot.use',
    manage: 'chatbot.manage',
  },
  admin: {
    roles:        'admin.roles',
    makerChecker: 'admin.maker_checker',
    system:       'admin.system',
    super:        'admin.super',
  },
} as const;

/** Union type of every permission key string */
export type PermissionKey = typeof P[keyof typeof P][keyof typeof P[keyof typeof P]];

/** Platform-level Super Admin — users.role = SUPER_ADMIN or profile.isSystemAdmin */
export const PLATFORM_ROLE = {
  SUPER_ADMIN: 'Super Admin',
} as const;

/** Re-export user-level enum for convenience */
export { UserRole } from '@/lib/roles';

/** Permissions only Super Admin can use (global backoffice) */
export const BACKOFFICE_PERMISSIONS = [P.admin.system, P.admin.super] as const;

/** Tenant-scoped system roles (assigned per workspace) */
export const SYSTEM_ROLES = ['Owner', 'Admin', 'Publisher', 'Creator', 'Viewer'] as const;
export type SystemRole = typeof SYSTEM_ROLES[number];

/** Roles that can approve/publish content */
export const APPROVER_ROLES: SystemRole[] = ['Owner', 'Admin', 'Publisher'];
/** Roles that cannot change content status beyond draft */
export const CREATOR_ONLY_ROLES: SystemRole[] = ['Creator', 'Viewer'];

/** Maker-checker action keys — must match the seeded `maker_checker_config` table */
export const MC = {
  contentPublish:  'content.publish',
  contentApprove:  'content.approve',
  leadsEmailBulk:  'leads.email_bulk',
  leadsDelete:     'leads.delete',
  mediaDelete:     'media.delete',
  templatesDelete: 'templates.delete',
  teamInvite:      'team.invite',
  teamRemove:      'team.remove',
  teamAssignRoles: 'team.assign_roles',
} as const;

export type McKey = typeof MC[keyof typeof MC];
