import type { ConfigService } from '@nestjs/config';

export function throttleOptionsFromConfig(config: ConfigService) {
  const ttlSecs = Number(
    config.get<string>('THROTTLE_TTL_SECS') ??
      config.get<string>('RATE_LIMIT_TTL') ??
      60,
  );
  const limit = Number(
    config.get<string>('THROTTLE_LIMIT') ??
      config.get<string>('RATE_LIMIT_MAX') ??
      500,
  );

  return {
    ttl: Math.max(1, ttlSecs) * 1000,
    limit: Math.max(1, limit),
  };
}
