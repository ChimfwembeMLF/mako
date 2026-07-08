#!/usr/bin/env node
/**
 * Load env exactly like the app, then try a real Postgres connection.
 * Run: NODE_ENV=production node scripts/test-db-connection.js
 */
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..');
const nodeEnv = process.env.NODE_ENV || 'development';

function mask(value) {
  if (!value) return '(empty)';
  const s = String(value);
  if (s.length <= 2) return '*'.repeat(s.length);
  return `${s[0]}${'*'.repeat(Math.max(0, s.length - 2))}${s[s.length - 1]} (len=${s.length})`;
}

function rawPasswordFrom(file) {
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (!t.startsWith('DB_PASSWORD=')) continue;
    let v = t.slice('DB_PASSWORD='.length).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return undefined;
}

// Same order as main.ts
const dotenv = require('dotenv');
for (const file of [`.env.${nodeEnv}`, '.env']) {
  const p = resolve(root, file);
  if (existsSync(p)) dotenv.config({ path: p });
}

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '5432', 10);
const user = process.env.DB_USERNAME || 'mako';
const password = process.env.DB_PASSWORD ?? '';
const database = process.env.DB_DATABASE || process.env.DB_NAME || 'mako_prod';

console.log('=== DB connection test ===');
console.log('NODE_ENV:', nodeEnv);
console.log('Files:');
console.log('  .env.production password:', mask(rawPasswordFrom(resolve(root, `.env.${nodeEnv}`)));
console.log('  .env password:            ', mask(rawPasswordFrom(resolve(root, '.env')));
console.log('');
console.log('App will use (first file wins):');
console.log('  host:    ', host, host === 'localhost' ? '← use 127.0.0.1 if psql -h 127.0.0.1 worked' : '');
console.log('  user:    ', user);
console.log('  database:', database);
console.log('  password:', mask(password));
console.log('');

const { Client } = require('pg');
const client = new Client({ host, port, user, password, database });

client
  .connect()
  .then(() => client.query('SELECT 1 AS ok'))
  .then((res) => {
    console.log('SUCCESS:', res.rows[0]);
    return client.end();
  })
  .catch((err) => {
    console.error('FAILED:', err.message);
    console.error('');
    console.error('Fix options:');
    console.error('  1) Set the SAME password in BOTH .env.production AND .env (production loads first!)');
    console.error('  2) Or: mv .env.production .env.production.bak  (only .env is used)');
    console.error('  3) Or reset Postgres to match .env exactly:');
    console.error(`     sudo -u postgres psql -c "ALTER USER ${user} WITH PASSWORD '${password.replace(/'/g, "''")}';"`);
    process.exit(1);
  });
