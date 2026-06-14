import { existsSync } from 'fs';
import { join } from 'path';

/** Paths checked for the Vite production build (newest first). */
export function resolveClientDistPath(): string {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'client', 'dist'),
    join(cwd, '..', 'autopilot-client', 'dist'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir;
  }
  return candidates[0];
}

export function isClientDistAvailable(): boolean {
  return existsSync(join(resolveClientDistPath(), 'index.html'));
}

export function isServeClientEnabled(): boolean {
  if (process.env.SERVE_CLIENT === 'false') return false;
  if (process.env.SERVE_CLIENT === 'true') return true;
  return process.env.NODE_ENV === 'production';
}
