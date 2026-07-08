import { SnakeNamingStrategy } from '../snake-naming.strategy';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserSubscriber } from 'src/entity-subscribers';
import { ConfigService } from '@nestjs/config';
import { resolveDatabaseName, resolveDbSsl } from './db-env.util';

export function typeOrmConfigFactory(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST') || 'localhost',
    port: parseInt(configService.get<string>('DB_PORT') || '5432', 10),
    username: configService.get<string>('DB_USERNAME') || 'thecodefather',
    password: configService.get<string>('DB_PASSWORD') || '',
    database: resolveDatabaseName(
      configService,
      isProduction ? 'autopilot_prod' : 'autopilot_dev',
    ),
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
    cache: false,
    namingStrategy: new SnakeNamingStrategy(),
    subscribers: [UserSubscriber],
    ssl: resolveDbSsl(configService),
  };
}
