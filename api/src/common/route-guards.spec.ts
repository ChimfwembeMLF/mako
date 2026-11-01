import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/** Controllers that are allowed public routes: sign-in, webhooks, legal pages and public catalogues. */
const PUBLIC_ROUTES_ALLOWED = [
  'app.controller.ts',
  'modules/ads/embed-ads.controller.ts',
  'modules/auth/auth.controller.ts',
  'modules/health/health.controller.ts',
  'modules/leads/leads.controller.ts',
  'modules/legal/legal.controller.ts',
  'modules/mail/mail.controller.ts',
  'modules/media/google-drive.controller.ts',
  'modules/payments/payments.controller.ts',
  'modules/platforms/platforms.controller.ts',
  'modules/social_accounts/social_accounts.controller.ts',
  'modules/subscriptions/plans.controller.ts',
  'modules/system_settings/system_settings.controller.ts',
];

const GUARD = /@UseGuards\(|@Auth\(/;

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return controllers(path);
    return name.endsWith('.controller.ts') ? [path] : [];
  });
}

function unguardedRoutes(source: string): string[] {
  const classStart = source.search(/export class \w+/);
  const decorators = source.slice(Math.max(source.indexOf('@Controller') - 300, 0), classStart);
  if (classStart < 0 || GUARD.test(decorators)) return [];
  const body = source.slice(classStart);
  const routes = [...body.matchAll(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/g)];
  return routes
    .filter((route) => {
      const before = body.slice(0, route.index);
      const start = Math.max(before.lastIndexOf('\n  }\n'), 0);
      const after = body.slice(route.index);
      const end = after.search(/\n  (async |public )?\w+\(/);
      return !GUARD.test(before.slice(start) + after.slice(0, end));
    })
    .map((route) => `${route[1].toUpperCase()} ${route[2]}`);
}

describe('API routes', () => {
  it('requires a guard on every route outside the public allowlist', () => {
    const root = join(__dirname, '..');
    const open = controllers(root)
      .map((path) => relative(root, path))
      .filter((path) => !PUBLIC_ROUTES_ALLOWED.includes(path))
      .flatMap((path) =>
        unguardedRoutes(readFileSync(join(root, path), 'utf8')).map(
          (route) => `${path}: ${route}`,
        ),
      );
    expect(open).toEqual([]);
  });
});
