#!/usr/bin/env node
/**
 * Shows which DB env vars the app would use (same load order as main.ts + migrations).
 * Run on server: node scripts/show-loaded-env.js
 */
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..');
const nodeEnv = process.env.NODE_ENV || 'development';

function mask(value) {
  if (value === undefined || value === null || value === '') return '(empty)';
  const s = String(value);
  if (s.length <= 2) return '*'.repeat(s.length);
  return `${s[0]}${'*'.repeat(Math.max(0, s.length - 2))}${s[s.length - 1]} (len=${s.length})`;
}

function readRawFromFile(filePath, key) {
  if (!existsSync(filePath)) return undefined;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) continue;
    let v = trimmed.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return undefined;
}

function simulateNestLoad() {
  // Fresh env — only keep NODE_ENV / PM2-injected vars user already had
  const base = { NODE_ENV: process.env.NODE_ENV };
  const saved = { ...process.env };
  process.env = { ...base };

  const dotenv = require('dotenv');
  const files = [`.env.${nodeEnv}`, '.env'];
  const loaded = [];
  for (const file of files) {
    const path = resolve(root, file);
    if (existsSync(path)) {
      dotenv.config({ path });
      loaded.push(path);
    }
  }

  const result = {
    loadedFiles: loaded,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE || process.env.DB_NAME,
    DB_SYNCHRONIZE: process.env.DB_SYNCHRONIZE,
    DB_SSL: process.env.DB_SSL,
  };

  process.env = saved;
  return result;
}

console.log('=== Mako env diagnostic ===');
console.log('cwd:', root);
console.log('NODE_ENV:', nodeEnv);
console.log('');

const envProd = resolve(root, `.env.${nodeEnv}`);
const envFile = resolve(root, '.env');
console.log('Files on disk:');
console.log(' ', envProd, existsSync(envProd) ? 'EXISTS' : 'missing');
console.log(' ', envFile, existsSync(envFile) ? 'EXISTS' : 'missing');
console.log(' ', resolve(root, 'config/production.yml'), existsSync(resolve(root, 'config/production.yml')) ? 'EXISTS (not auto-loaded by Nest)' : 'missing');
console.log('');

console.log('Raw DB_PASSWORD in each file (masked):');
console.log('  .env.production:', mask(readRawFromFile(envProd, 'DB_PASSWORD')));
console.log('  .env:            ', mask(readRawFromFile(envFile, 'DB_PASSWORD')));
console.log('');

console.log('Raw DB_DATABASE in each file:');
console.log('  .env.production:', readRawFromFile(envProd, 'DB_DATABASE') || readRawFromFile(envProd, 'DB_NAME') || '(not set)');
console.log('  .env:            ', readRawFromFile(envFile, 'DB_DATABASE') || readRawFromFile(envFile, 'DB_NAME') || '(not set)');
console.log('');

const sim = simulateNestLoad();
console.log('After Nest load order (.env.production → .env, first key wins):');
console.log('  loaded:', sim.loadedFiles.join('\n          ') || '(none)');
console.log('  DB_HOST:     ', sim.DB_HOST || '(default localhost)');
console.log('  DB_PORT:     ', sim.DB_PORT || '5432');
console.log('  DB_USERNAME: ', sim.DB_USERNAME || '(default thecodefather)');
console.log('  DB_PASSWORD: ', mask(sim.DB_PASSWORD));
console.log('  DB_DATABASE: ', sim.DB_DATABASE || '(default autopilot_prod in prod)');
console.log('  DB_SYNCHRONIZE:', sim.DB_SYNCHRONIZE);
console.log('');

console.log('Current shell process.env DB_* (may include PM2 — run via pm2 env 0 for live app):');
console.log('  DB_PASSWORD: ', mask(process.env.DB_PASSWORD));
console.log('');

console.log('Tip: pm2 env 0 | grep -E "^DB_|^NODE_ENV"');
