import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const SKIP_PATH_PREFIXES = [
  '/api/v1/health',
  '/documentation',
  '/admin/queues',
];

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (process.env.THROTTLE_ENABLED === 'false') {
      return true;
    }
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const path = request.url?.split('?')[0] ?? '';
    if (SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return true;
    }

    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = this.jwtSubject(req);
    if (userId) return `user:${userId}`;

    const forwarded = (req.headers as Record<string, string | string[] | undefined> | undefined)?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }

    const realIp = (req.headers as Record<string, string | string[] | undefined> | undefined)?.['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }

    return String(req.ip ?? 'unknown');
  }

  private jwtSubject(req: Record<string, unknown>): string | null {
    const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
    const auth = headers?.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return null;
    }

    const token = auth.slice(7).trim();
    const parts = token.split('.');
    if (parts.length < 2) return null;

    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as { sub?: string };
      return payload.sub?.trim() || null;
    } catch {
      return null;
    }
  }
}
