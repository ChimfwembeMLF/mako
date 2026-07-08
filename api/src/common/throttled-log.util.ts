import { Logger } from '@nestjs/common';

const lastLoggedAt = new Map<string, number>();

/** Log at most once per key within ttlMs (default 1 hour). */
export function logOnce(
  logger: Logger,
  level: 'debug' | 'verbose' | 'warn' | 'log',
  key: string,
  message: string,
  ttlMs = 60 * 60 * 1000,
): void {
  const now = Date.now();
  const prev = lastLoggedAt.get(key) ?? 0;
  if (now - prev < ttlMs) return;
  lastLoggedAt.set(key, now);
  logger[level](message);
}

export function isRecoverableMetaTokenError(err: unknown): boolean {
  const summary =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
      ? JSON.stringify(err)
      : String(err);
  return (
    /code 100|code 101|code 190|Error validating application|nonexisting field \(accounts\)/i.test(
      summary,
    ) || /401|403/.test(summary)
  );
}
