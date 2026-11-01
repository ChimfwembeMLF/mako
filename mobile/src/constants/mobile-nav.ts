/**
 * Mobile navigation config — mirrors web SOCIAL_NAV_GROUPS + MORE_ITEMS subset.
 * @see client/src/lib/nav-config.ts, specs/007-mobile-ui-parity/research.md R1
 */

import type { IconName } from '../components/ui/Icon';

export type MobileNavItem = {
  title: string;
  /** Expo Router path under (tabs)/more or core tabs */
  route: string;
  description?: string;
  /** Permission key(s) required; omit for any authenticated user */
  permission?: string | string[];
  /** Super-admin only (backoffice) — excluded from mobile v1 */
  superAdmin?: boolean;
  /** Lucide icon shown in More menu rows */
  icon: IconName;
  group: string;
  /** When true, show locked row if permission denied */
  showWhenLocked?: boolean;
};

/** Social shell groups — maps to More stack routes. Bottom-bar destinations are left out. */
export const SOCIAL_NAV_GROUPS: Array<{ label: string; items: MobileNavItem[] }> = [
  {
    label: 'Create',
    items: [
      {
        title: 'Brand voice',
        route: '/more/brand-brain',
        description: 'Voice, audience & guidelines',
        permission: 'settings.brand_brain',
        icon: 'brain',
        group: 'Create',
        showWhenLocked: true,
      },
      {
        title: 'Campaigns',
        route: '/more/campaigns',
        description: 'Plan multi-post campaigns',
        permission: 'content.view',
        icon: 'campaigns',
        group: 'Create',
        showWhenLocked: true,
      },
      {
        title: 'Social accounts',
        route: '/connections',
        description: 'Link social & ad accounts',
        icon: 'connections',
        group: 'Create',
      },
    ],
  },
  {
    label: 'Inbox',
    items: [
      {
        title: 'WhatsApp',
        route: '/more/whatsapp',
        description: 'Connection status',
        icon: 'whatsapp',
        group: 'Inbox',
      },
      {
        title: 'Leads',
        route: '/more/leads',
        description: 'Qualify and respond to inbound leads',
        permission: 'leads.view',
        icon: 'leads',
        group: 'Inbox',
        showWhenLocked: true,
      },
      {
        title: 'Auto-reply rules',
        route: '/more/auto-reply-rules',
        description: 'Inbox automation rules',
        permission: 'replies.manage_rules',
        icon: 'zap',
        group: 'Inbox',
        showWhenLocked: true,
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        title: 'Analytics',
        route: '/more/analytics',
        description: 'Performance insights',
        permission: 'analytics.view',
        icon: 'analytics',
        group: 'Insights',
        showWhenLocked: true,
      },
    ],
  },
  {
    label: 'Library',
    items: [
      {
        title: 'Media',
        route: '/more/media',
        description: 'Images & assets',
        permission: 'media.view',
        icon: 'media',
        group: 'Library',
        showWhenLocked: true,
      },
      {
        title: 'Post Templates',
        route: '/more/templates',
        description: 'Reusable post copy',
        permission: 'templates.view',
        icon: 'templates',
        group: 'Library',
        showWhenLocked: true,
      },
    ],
  },
];

/** Admin / account items from web MORE_ITEMS (mobile subset) */
export const MORE_ITEMS: MobileNavItem[] = [
  {
    title: 'Team',
    route: '/more/team',
    description: 'Members, invites & roles',
    permission: 'team.view',
    icon: 'team',
    group: 'Admin',
    showWhenLocked: true,
  },
  {
    title: 'Approvals',
    route: '/more/approvals',
    description: 'Review pending content',
    permission: 'approvals.view',
    icon: 'approvals',
    group: 'Admin',
    showWhenLocked: true,
  },
  {
    title: 'Settings',
    route: '/more/settings',
    description: 'Account & workspace preferences',
    permission: 'settings.view',
    icon: 'settings',
    group: 'Admin',
    showWhenLocked: true,
  },
];

export type NavAccessContext = {
  can: (key: string) => boolean;
  isSuperAdmin: boolean;
  loading: boolean;
};

function itemAllowed(item: MobileNavItem, ctx: NavAccessContext): boolean {
  if (item.superAdmin) return ctx.isSuperAdmin;
  if (!item.permission) return true;
  const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
  return perms.some((p) => ctx.can(p));
}

/** Items the user can navigate to */
export function filterAccessibleNavItems(items: MobileNavItem[], ctx: NavAccessContext): MobileNavItem[] {
  if (ctx.loading) return [];
  return items.filter((item) => itemAllowed(item, ctx));
}

/** All More menu rows including locked placeholders */
export function buildMoreMenuRows(ctx: NavAccessContext): Array<{
  group: string;
  items: Array<MobileNavItem & { locked: boolean }>;
}> {
  const allGroups = [...SOCIAL_NAV_GROUPS, { label: 'Admin', items: MORE_ITEMS }];
  return allGroups.map((group) => ({
    group: group.label,
    items: group.items
      .filter((item) => !item.superAdmin)
      .map((item) => ({
        ...item,
        locked: !itemAllowed(item, ctx),
      }))
      .filter((item) => !item.locked || item.showWhenLocked !== false),
  })).filter((g) => g.items.length > 0);
}
