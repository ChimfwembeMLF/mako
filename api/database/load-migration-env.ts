import { resolve } from 'path';
import { loadEnvFiles } from '../scripts/load-env';

/** Load env the same way as Nest AppModule (`.env.${NODE_ENV}` then `.env`). */
export function loadMigrationEnv(): void {
  loadEnvFiles();
}

export function migrationDbDefaults(): {
  username: string;
  password: string;
  database: string;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    username: process.env.DB_USERNAME?.trim() || (isProduction ? 'mako' : 'thecodefather'),
    password: process.env.DB_PASSWORD ?? '',
    database: isProduction ? 'autopilot_prod' : 'autopilot_dev',
  };
}

export function logMigrationTarget(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const db =
    process.env.DB_DATABASE?.trim() ||
    process.env.DB_NAME?.trim() ||
    migrationDbDefaults().database;
  const user =
    process.env.DB_USERNAME?.trim() || migrationDbDefaults().username;
  console.log(
    `[migrations] NODE_ENV=${isProduction ? 'production' : 'development'} → ${user}@${host}:${port}/${db}`,
  );
}

export function migrationRoot(): string {
  return resolve(__dirname, '..');
}
