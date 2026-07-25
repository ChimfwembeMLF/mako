import { P, type PermissionKey } from '@/lib/permissions';

export type ProductShell = 'main' | 'social';

/**
 * Paths that use Social chrome (research R1/R6).
 * Longest-prefix match: `/content/edit/1` matches `/content`.
 */
export const SOCIAL_PATH_PREFIXES: string[] = [
  '/social',
  '/brand-brain',
  '/content',
  '/campaigns',
  '/scheduler',
  '/publisher',
  '/replies',
  '/media',
  '/templates',
  '/analytics',
  '/reports',
  '/whatsapp',
];

/** Permissions that allow entering the Social dashboard home. */
export const SOCIAL_ACCESS_PERMISSIONS: PermissionKey[] = [
  P.content.view,
  P.content.create,
  P.content.edit,
  P.content.publish,
  P.replies.view,
  P.analytics.view,
  P.media.view,
  P.templates.view,
  P.settings.brandBrain,
];

export function resolveProductShell(pathname: string): ProductShell {
  const path = pathname.split('?')[0] || '/';
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return 'main';
  for (const prefix of SOCIAL_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return 'social';
  }
  return 'main';
}

export function canAccessSocialShell(
  canAny: (...perms: PermissionKey[]) => boolean,
): boolean {
  return canAny(...SOCIAL_ACCESS_PERMISSIONS);
}
