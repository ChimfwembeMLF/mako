/** Permission keys — must stay in sync with autopilot-client/src/lib/permissions.ts */
export const PERMISSION_DEFINITIONS: { key: string; label: string; module: string; description?: string }[] = [
  { key: 'content.view', label: 'View content', module: 'content' },
  { key: 'content.create', label: 'Create content', module: 'content' },
  { key: 'content.edit', label: 'Edit content', module: 'content' },
  { key: 'content.delete', label: 'Delete content', module: 'content' },
  { key: 'content.approve', label: 'Approve content', module: 'content' },
  { key: 'content.publish', label: 'Publish content', module: 'content' },
  { key: 'leads.view', label: 'View leads', module: 'leads' },
  { key: 'leads.email', label: 'Email leads', module: 'leads' },
  { key: 'leads.email_bulk', label: 'Bulk email leads', module: 'leads' },
  { key: 'leads.classify', label: 'Classify leads', module: 'leads' },
  { key: 'leads.delete', label: 'Delete leads', module: 'leads' },
  { key: 'leads.export', label: 'Export leads', module: 'leads' },
  { key: 'media.view', label: 'View media', module: 'media' },
  { key: 'media.upload', label: 'Upload media', module: 'media' },
  { key: 'media.delete', label: 'Delete media', module: 'media' },
  { key: 'templates.view', label: 'View templates', module: 'templates' },
  { key: 'templates.create', label: 'Create templates', module: 'templates' },
  { key: 'templates.edit', label: 'Edit templates', module: 'templates' },
  { key: 'templates.delete', label: 'Delete templates', module: 'templates' },
  { key: 'templates.activate', label: 'Activate templates', module: 'templates' },
  { key: 'replies.view', label: 'View replies', module: 'replies' },
  { key: 'replies.create', label: 'Create replies', module: 'replies' },
  { key: 'replies.manage_rules', label: 'Manage reply rules', module: 'replies' },
  { key: 'analytics.view', label: 'View analytics', module: 'analytics' },
  { key: 'team.view', label: 'View team', module: 'team' },
  { key: 'team.invite', label: 'Invite team members', module: 'team' },
  { key: 'team.remove', label: 'Remove team members', module: 'team' },
  { key: 'team.assign_roles', label: 'Assign roles', module: 'team' },
  { key: 'team.assign_permissions', label: 'Assign permissions', module: 'team' },
  { key: 'settings.view', label: 'View settings', module: 'settings' },
  { key: 'settings.billing', label: 'Manage billing', module: 'settings' },
  { key: 'settings.brand_brain', label: 'Manage brand brain', module: 'settings' },
  { key: 'approvals.view', label: 'View approvals', module: 'approvals' },
  { key: 'approvals.review', label: 'Review approvals', module: 'approvals' },
  { key: 'audit.view', label: 'View audit logs', module: 'audit' },
  { key: 'admin.roles', label: 'Manage roles', module: 'admin' },
  { key: 'admin.maker_checker', label: 'Manage maker-checker', module: 'admin' },
  { key: 'admin.system', label: 'System settings & theme', module: 'admin' },
  { key: 'admin.super', label: 'Platform super admin (backoffice)', module: 'admin' },
];

/** Platform Super Admin — profile.isSystemAdmin or users.role = SUPER_ADMIN */
export const SUPER_ADMIN_PROFILE_FLAG = 'isSystemAdmin';
export const SUPER_ADMIN_USER_ROLE = 'SUPER_ADMIN';

/** Permissions granted to Super Admin regardless of tenant role */
export const SUPER_ADMIN_PERMISSIONS = PERMISSION_DEFINITIONS.filter((p) =>
  p.key.startsWith('admin.'),
).map((p) => p.key);

/** Permissions reserved for platform Super Admin — not granted via tenant roles */
export const BACKOFFICE_ONLY_PERMISSIONS = ['admin.system', 'admin.super'] as const;

/** All permissions assignable within a tenant (excludes platform backoffice) */
export const TENANT_SCOPED_PERMISSIONS = PERMISSION_DEFINITIONS.map((p) => p.key).filter(
  (k) => !(BACKOFFICE_ONLY_PERMISSIONS as readonly string[]).includes(k),
);

export const SYSTEM_ROLE_DEFINITIONS: {
  name: string;
  description: string;
  permissions: string[] | '*';
}[] = [
  {
    name: 'Owner',
    description: 'Full access within the workspace (tenant-scoped)',
    permissions: TENANT_SCOPED_PERMISSIONS,
  },
  {
    name: 'Admin',
    description: 'Manage team, settings, and all content',
    permissions: TENANT_SCOPED_PERMISSIONS.filter((k) => k !== 'admin.maker_checker'),
  },
  {
    name: 'Publisher',
    description: 'Publish and approve content, manage social',
    permissions: [
      'content.view', 'content.create', 'content.edit', 'content.approve', 'content.publish',
      'leads.view', 'leads.email', 'leads.classify',
      'media.view', 'media.upload',
      'templates.view', 'templates.create', 'templates.edit', 'templates.activate',
      'replies.view', 'replies.create',
      'analytics.view',
      'team.view',
      'settings.view', 'settings.brand_brain',
      'approvals.view', 'approvals.review',
    ],
  },
  {
    name: 'Creator',
    description: 'Create and edit content drafts',
    permissions: [
      'content.view', 'content.create', 'content.edit',
      'leads.view',
      'media.view', 'media.upload',
      'templates.view',
      'replies.view',
      'analytics.view',
      'team.view',
      'settings.view',
    ],
  },
  {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'content.view', 'leads.view', 'media.view', 'templates.view',
      'replies.view', 'analytics.view', 'team.view', 'settings.view',
    ],
  },
];

export const APPROVAL_WORKFLOW_DEFINITIONS: {
  actionKey: string;
  label: string;
  description: string;
  approverRoleName: string;
}[] = [
  { actionKey: 'content.publish', label: 'Publish content', description: 'Requires approval before content goes live', approverRoleName: 'Publisher' },
  { actionKey: 'content.approve', label: 'Approve content', description: 'Requires second approval for content approval', approverRoleName: 'Publisher' },
  { actionKey: 'leads.email_bulk', label: 'Bulk email leads', description: 'Requires approval before bulk lead emails', approverRoleName: 'Admin' },
  { actionKey: 'leads.delete', label: 'Delete leads', description: 'Requires approval before deleting leads', approverRoleName: 'Admin' },
  { actionKey: 'media.delete', label: 'Delete media', description: 'Requires approval before deleting media assets', approverRoleName: 'Admin' },
  { actionKey: 'templates.delete', label: 'Delete templates', description: 'Requires approval before deleting templates', approverRoleName: 'Admin' },
  { actionKey: 'team.invite', label: 'Invite team member', description: 'Requires approval before sending invites', approverRoleName: 'Admin' },
  { actionKey: 'team.remove', label: 'Remove team member', description: 'Requires approval before removing members', approverRoleName: 'Admin' },
  { actionKey: 'team.assign_roles', label: 'Assign roles', description: 'Requires approval before changing roles', approverRoleName: 'Admin' },
];
