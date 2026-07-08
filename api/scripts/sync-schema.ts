/**
 * One-time (or repair) schema sync from TypeORM entities.
 *
 * Dev uses DB_SYNCHRONIZE=true; production uses migrations for *changes* only.
 * Migrations in database/migrations/ are incremental patches — they do NOT create
 * core tables (content_items, users, tenants, etc.). Run this on a fresh prod DB
 * before migrations:run.
 *
 * Safe to re-run: adds missing tables/columns; does not drop existing data.
 *
 * Usage: npm run db:sync
 */
import { loadEnvFiles } from './load-env';

loadEnvFiles();

import * as path from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '../src/snake-naming.strategy';
import {
  resolveDatabaseNameFromEnv,
  resolveMigrationSsl,
} from '../src/database/db-env.util';

async function main() {
  const database = resolveDatabaseNameFromEnv(process.env);
  console.log(`Syncing schema to ${process.env.DB_HOST}:${process.env.DB_PORT}/${database} ...`);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database,
    entities: [path.join(__dirname, '../src/**/*.entity.{ts,js}')],
    synchronize: true,
    migrations: [],
    namingStrategy: new SnakeNamingStrategy(),
    ssl: resolveMigrationSsl(process.env),
    logging: ['schema'],
  });

  await dataSource.initialize();
  console.log('Schema sync complete.');
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Schema sync failed:', err);
  process.exit(1);
});
