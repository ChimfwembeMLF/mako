/**
 * PM2 process file for the NestJS API (production).
 *
 * Requires `.env` in this directory — copy from docs/env.production.template
 *
 * Usage:
 *   npm run build
 *   npm run pm2:start          # first start (production)
 *   npm run deploy:prod        # build + migrate + restart
 *   npm run pm2:logs
 */
const path = require('path');
const fs = require('fs');

function parseEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const root = __dirname;
const envFromFile = parseEnvFile(path.join(root, '.env'));

/** Defaults aligned with config/production.yml */
const productionDefaults = {
  NODE_ENV: 'production',
  PORT: '5000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'mako',
  DB_DATABASE: 'autopilot_prod',
  DB_SYNCHRONIZE: 'false',
};

module.exports = {
  apps: [
    {
      name: 'autopilot-api',
      script: 'dist/main.js',
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      time: true,
      merge_logs: true,
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      env_production: {
        ...productionDefaults,
        ...envFromFile,
        NODE_ENV: 'production',
        PORT: envFromFile.PORT || productionDefaults.PORT,
      },
    },
  ],
};
