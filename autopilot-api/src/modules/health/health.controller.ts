import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  MAKO_CORS_BUILD,
  isCorsDisabled,
  resolveCorsOrigins,
  describeCorsMode,
} from '../../common/cors.util';
import { isClientServedByNest } from '../../common/client-dist.util';
import { summarizeOAuthEnv } from '../../common/oauth-env.util';

@ApiTags('Health')
@Controller('api/v1/health')
export class HealthController {
  @Get()
  check() {
    const serveClient = isClientServedByNest();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      port: process.env.PORT,
      service: 'Mako API',
      version: '1.0.0',
      apiMode: serveClient ? 'same-origin' : 'cross-origin',
      serveClient,
      corsBuild: MAKO_CORS_BUILD,
      corsMode: describeCorsMode(),
      corsDisabled: isCorsDisabled(),
      corsOrigins: resolveCorsOrigins(),
      oauth: summarizeOAuthEnv(),
    };
  }
}
