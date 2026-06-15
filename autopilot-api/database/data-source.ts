import * as path from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '../src/snake-naming.strategy';
import {
  resolveDatabaseNameFromEnv,
  resolveMigrationSsl,
  resolveDbPoolExtra,
} from '../src/database/db-env.util';
import {
  loadMigrationEnv,
  logMigrationTarget,
  migrationDbDefaults,
  migrationRoot,
} from './load-migration-env';

loadMigrationEnv();
logMigrationTarget();

const defaults = migrationDbDefaults();
const root = migrationRoot();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: defaults.username,
  password: defaults.password,
  database: resolveDatabaseNameFromEnv(process.env, defaults.database),
  entities: [path.join(root, 'src/**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, './migrations/*.{ts,js}')],
  namingStrategy: new SnakeNamingStrategy(),
  ssl: resolveMigrationSsl(process.env),
  extra: resolveDbPoolExtra(),
});
