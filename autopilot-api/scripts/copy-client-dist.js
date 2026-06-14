#!/usr/bin/env node
/**
 * Copies autopilot-client/dist → autopilot-api/client/dist for Nest static serving.
 */
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../autopilot-client/dist');
const dest = path.resolve(__dirname, '../client/dist');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('[copy-client-dist] Missing build at', src);
  console.error('Run: cd ../autopilot-client && VITE_API_BASE_URL= yarn build');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[copy-client-dist] Copied', src, '→', dest);
