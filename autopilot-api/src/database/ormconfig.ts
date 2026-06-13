import { SnakeNamingStrategy } from '../snake-naming.strategy';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserSubscriber } from 'src/entity-subscribers';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as path from 'path';

export function typeOrmConfigFactory(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  const certPath = configService.get<string>('CERTIFICATE_PATH')?.trim();
  const certName = configService.get<string>('CERTIFICATE_NAME')?.trim();
  const ssl =
    isProduction && certPath && certName
      ? { ca: readFileSync(path.join(process.cwd(), certPath, certName)) }
      : false;

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST') || 'localhost',
    port: parseInt(configService.get<string>('DB_PORT') || '5432', 10),
    username: configService.get<string>('DB_USERNAME') || 'thecodefather',
    password: configService.get<string>('DB_PASSWORD') || '',
    database: configService.get<string>('DB_DATABASE') || 'nest',
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
    cache: false,
    namingStrategy: new SnakeNamingStrategy(),
    subscribers: [UserSubscriber],
    ssl,
  };
}
