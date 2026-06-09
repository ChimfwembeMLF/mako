import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'pass104',
    database: process.env.DB_DATABASE || 'autopilot_dev',
  });

  const sql = readFileSync(
    join(__dirname, 'fix-approval-workflows-schema.sql'),
    'utf8',
  );

  await client.connect();
  try {
    await client.query(sql);
    console.log('Schema fix applied. Now run with DB_SYNCHRONIZE=true once, then seed:dev.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
