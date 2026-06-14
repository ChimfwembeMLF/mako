import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  MAKO_CORS_BUILD,
  isCorsDisabled,
  resolveCorsOrigins,
  describeCorsMode,
} from '../../common/cors.util';
import { isClientDistAvailable, isServeClientEnabled } from '../../common/client-dist.util';

@ApiTags('Health')
@Controller('api/v1/health')
export class HealthController {
  @Get()
  check() {
    const serveClient = isServeClientEnabled() && isClientDistAvailable();
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
    };
  }
}
