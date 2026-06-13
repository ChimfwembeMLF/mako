import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/** Load single-line KEY=value pairs from .env files (same order as AppModule). */
function parseEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Populate process.env from .env.production then .env before standalone scripts run. */
export function loadEnvFiles(): void {
  const root = resolve(__dirname, '..');
  const nodeEnv = process.env.NODE_ENV || 'development';
  parseEnvFile(resolve(root, `.env.${nodeEnv}`));
  parseEnvFile(resolve(root, '.env'));
  if (process.env.DB_NAME && !process.env.DB_DATABASE) {
    process.env.DB_DATABASE = process.env.DB_NAME;
  }
}
