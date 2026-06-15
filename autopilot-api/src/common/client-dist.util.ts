import { existsSync } from 'fs';
import { join } from 'path';

/** Paths handled by Nest — must never receive the React index.html fallback. */
export const SPA_BYPASS_PREFIXES = [
  '/api',
  '/uploads',
  '/documentation',
  '/admin',
] as const;

export function shouldBypassSpa(pathname: string): boolean {
  return SPA_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Paths checked for the Vite production build. */
export function resolveClientDistPath(): string {
  return join(process.cwd(), 'client', 'dist');
}

export function isClientDistAvailable(): boolean {
  return existsSync(join(resolveClientDistPath(), 'index.html'));
}

export function isServeClientEnabled(): boolean {
  if (process.env.SERVE_CLIENT === 'false') return false;
  if (process.env.SERVE_CLIENT === 'true') return true;
  return process.env.NODE_ENV === 'production';
}
