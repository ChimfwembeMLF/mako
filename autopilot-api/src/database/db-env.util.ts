import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

/** Canonical DB name — accepts legacy DB_NAME env var. */
export function resolveDatabaseName(
  configService: ConfigService,
  fallback = 'autopilot_dev',
): string {
  return (
    configService.get<string>('DB_DATABASE')?.trim() ||
    configService.get<string>('DB_NAME')?.trim() ||
    fallback
  );
}

export function resolveDatabaseNameFromEnv(
  env: NodeJS.ProcessEnv,
  fallback = 'autopilot_dev',
): string {
  return env.DB_DATABASE?.trim() || env.DB_NAME?.trim() || fallback;
}

export function resolveDbSsl(configService: ConfigService): false | { ca: Buffer } {
  if (configService.get<string>('DB_SSL') !== 'true') return false;
  const certPath = configService.get<string>('CERTIFICATE_PATH')?.trim();
  const certName = configService.get<string>('CERTIFICATE_NAME')?.trim();
  if (!certPath || !certName) return false;
  const fullPath = path.join(process.cwd(), certPath, certName);
  if (!existsSync(fullPath)) {
    console.warn(`DB_SSL=true but certificate missing at ${fullPath} — using non-SSL connection`);
    return false;
  }
  return { ca: readFileSync(fullPath) };
}

export function resolveMigrationSsl(env: NodeJS.ProcessEnv): false | { ca: Buffer } {
  if (env.DB_SSL !== 'true') return false;
  const certPath = env.CERTIFICATE_PATH?.trim();
  const certName = env.CERTIFICATE_NAME?.trim();
  if (!certPath || !certName) return false;
  const fullPath = path.join(process.cwd(), certPath, certName);
  if (!existsSync(fullPath)) return false;
  return { ca: readFileSync(fullPath) };
}
