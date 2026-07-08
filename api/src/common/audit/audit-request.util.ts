import { Request } from 'express';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

const SKIP_PATH_PREFIXES = [
  '/uploads',
  '/public',
  '/api-docs',
  '/swagger',
  '/favicon.ico',
];

const SKIP_EXACT_PATHS = new Set(['/', '/health', '/api/v1/health']);

export function shouldSkipAudit(path: string, method: string): boolean {
  if (method === 'OPTIONS') return true;
  const normalized = path.split('?')[0];
  if (SKIP_EXACT_PATHS.has(normalized)) return true;
  return SKIP_PATH_PREFIXES.some((p) => normalized.startsWith(p));
}

export function extractUserId(req: Request): string | undefined {
  const sub = (req as Request & { user?: { sub?: string } }).user?.sub;
  if (sub && UUID_RE.test(String(sub))) return String(sub);
  return undefined;
}

export function extractTenantIdFromRequest(req: Request): string | undefined {
  const q = req.query as Record<string, unknown>;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const p = req.params as Record<string, unknown>;

  const candidates = [
    q.tenantId,
    q.tenant_id,
    b.tenantId,
    b.tenant_id,
    p.tenantId,
    p.tenant_id,
    req.headers['x-tenant-id'],
  ];

  for (const raw of candidates) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && UUID_RE.test(value)) return value;
  }
  return undefined;
}

export function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress;
}

export function buildRequestAction(method: string, path: string): string {
  const normalized = path.split('?')[0];
  return `http.${method.toUpperCase()} ${normalized}`;
}

export function resourceTypeFromPath(path: string): string {
  const segment = path
    .split('?')[0]
    .replace(/^\/api\/v1\//, '')
    .split('/')[0];
  return segment || 'http';
}
