import { matchPath } from 'react-router-dom';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

const HOME: BreadcrumbItem = { label: 'Home', href: '/' };
const DASH: BreadcrumbItem = { label: 'Dashboard', href: '/dashboard' };
const ADMIN: BreadcrumbItem = { label: 'Admin', href: '/admin/roles' };
const CHATBOT: BreadcrumbItem = { label: 'Chatbot', href: '/chatbot' };
const CONTENT: BreadcrumbItem = { label: 'Content Engine', href: '/content' };
const TEAM: BreadcrumbItem = { label: 'Team', href: '/team' };
const TEMPLATES: BreadcrumbItem = { label: 'Templates', href: '/templates' };

/** Paths where breadcrumbs are hidden (marketing / full-bleed landing). */
export const BREADCRUMB_HIDDEN_PATHS = new Set(['/', '/home']);

type RoutePattern = {
  path: string;
  crumbs: BreadcrumbItem[];
};

/** Longest paths first so `/content/edit/:id` wins over `/content/:id`. */
const ROUTE_PATTERNS: RoutePattern[] = [
  { path: '/content/edit/:id', crumbs: [DASH, CONTENT, { label: 'Edit' }] },
  { path: '/content/:id', crumbs: [DASH, CONTENT, { label: 'Content' }] },
  { path: '/templates/:id', crumbs: [DASH, TEMPLATES, { label: 'Edit template' }] },
  { path: '/team/:userId/permissions', crumbs: [DASH, TEAM, { label: 'Permissions' }] },
  { path: '/contact/:sourceId', crumbs: [HOME, { label: 'Contact' }] },
  { path: '/chatbot/knowledge', crumbs: [DASH, CHATBOT, { label: 'Knowledge' }] },
  { path: '/chatbot/sessions', crumbs: [DASH, CHATBOT, { label: 'Sessions' }] },
  { path: '/dashboard', crumbs: [DASH] },
  { path: '/brand-brain', crumbs: [DASH, { label: 'Brand Brain' }] },
  { path: '/content', crumbs: [DASH, CONTENT] },
  { path: '/campaigns', crumbs: [DASH, { label: 'Campaigns' }] },
  { path: '/scheduler', crumbs: [DASH, { label: 'Scheduler' }] },
  { path: '/leads', crumbs: [DASH, { label: 'Lead Agent' }] },
  { path: '/mail', crumbs: [DASH, { label: 'Mail' }] },
  { path: '/analytics', crumbs: [DASH, { label: 'Analytics' }] },
  { path: '/reports', crumbs: [DASH, { label: 'Reports' }] },
  { path: '/publisher', crumbs: [DASH, { label: 'Publisher Connect' }] },
  { path: '/settings', crumbs: [DASH, { label: 'Settings' }] },
  { path: '/media', crumbs: [DASH, { label: 'Media Library' }] },
  { path: '/templates', crumbs: [DASH, TEMPLATES] },
  { path: '/replies', crumbs: [DASH, { label: 'Replies' }] },
  { path: '/chatbot', crumbs: [DASH, CHATBOT] },
  { path: '/approvals', crumbs: [DASH, { label: 'Approvals' }] },
  { path: '/team', crumbs: [DASH, TEAM] },
  { path: '/audit', crumbs: [DASH, { label: 'Audit Logs' }] },
  { path: '/billing', crumbs: [DASH, { label: 'Billing' }] },
  { path: '/ads', crumbs: [DASH, { label: 'Ads' }] },
  { path: '/export', crumbs: [DASH, { label: 'Export' }] },
  { path: '/workspaces', crumbs: [DASH, { label: 'Workspaces' }] },
  { path: '/admin/roles', crumbs: [DASH, ADMIN, { label: 'Roles' }] },
  { path: '/admin/maker-checker', crumbs: [DASH, ADMIN, { label: 'Maker-Checker' }] },
  { path: '/admin/system', crumbs: [DASH, ADMIN, { label: 'System Settings' }] },
  { path: '/admin/backoffice', crumbs: [DASH, { label: 'Backoffice' }] },
  { path: '/admin/queues', crumbs: [DASH, ADMIN, { label: 'Queue Jobs' }] },
  { path: '/auth/callback', crumbs: [HOME, { label: 'Sign in', href: '/auth' }, { label: 'Callback' }] },
  { path: '/auth', crumbs: [HOME, { label: 'Sign in' }] },
  { path: '/reset-password', crumbs: [HOME, { label: 'Reset password' }] },
  { path: '/privacy', crumbs: [HOME, { label: 'Privacy Policy' }] },
  { path: '/terms', crumbs: [HOME, { label: 'Terms of Service' }] },
  { path: '/data-deletion', crumbs: [HOME, { label: 'Data Deletion' }] },
].sort((a, b) => b.path.length - a.path.length);

export function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (BREADCRUMB_HIDDEN_PATHS.has(pathname)) return [];

  for (const { path, crumbs } of ROUTE_PATTERNS) {
    if (matchPath({ path, end: true }, pathname)) {
      return crumbs;
    }
  }

  return [HOME, { label: 'Page not found' }];
}
