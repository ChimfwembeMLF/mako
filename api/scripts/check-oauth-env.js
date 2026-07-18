#!/usr/bin/env node
/** Print OAuth callback config (no secrets). Run: NODE_ENV=production node scripts/check-oauth-env.js */
const { existsSync } = require('fs');
const { resolve } = require('path');

const dotenv = require('dotenv');
const root = resolve(__dirname, '..');
const nodeEnv = process.env.NODE_ENV || 'production';
for (const file of [`.env.${nodeEnv}`, '.env']) {
  const p = resolve(root, file);
  if (existsSync(p)) dotenv.config({ path: p });
}

// Mirror src/common/env-urls.util.ts normalizeProductionUrls
if (nodeEnv === 'production') {
  const publicUrl =
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.API_URL?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (!process.env.FRONTEND_URL?.trim() && publicUrl) {
    process.env.FRONTEND_URL = publicUrl;
  }
  if (!process.env.API_PUBLIC_URL?.trim() && publicUrl) {
    process.env.API_PUBLIC_URL = publicUrl;
  }
}

const keys = [
  'FRONTEND_URL',
  'API_PUBLIC_URL',
  'SERVE_CLIENT',
  'GOOGLE_CALLBACK_URL',
  'FACEBOOK_CALLBACK_URL',
  'LINKEDIN_CALLBACK_URL',
  'INSTAGRAM_CALLBACK_URL',
  'FACEBOOK_SOCIAL_CALLBACK_URL',
  'LINKEDIN_SOCIAL_CALLBACK_URL',
  'INSTAGRAM_SOCIAL_CALLBACK_URL',
  'WHATSAPP_SOCIAL_CALLBACK_URL',
  'TWITTER_SOCIAL_CALLBACK_URL',
];

console.log('=== OAuth env check ===');
console.log('NODE_ENV:', nodeEnv);
let bad = 0;
for (const key of keys) {
  const v = process.env[key]?.trim();
  if (!v) {
    console.log(`  ${key}: (missing)`);
    if (
      key === 'FRONTEND_URL' ||
      key === 'API_PUBLIC_URL' ||
      key.includes('CALLBACK')
    ) {
      bad++;
    }
    continue;
  }
  const flag = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(v) ? ' ← FIX (localhost)' : '';
  if (flag) bad++;
  console.log(`  ${key}: ${v}${flag}`);
}
console.log('');
if (bad) {
  console.error(`${bad} issue(s) — OAuth/SPA will fail until fixed`);
  process.exit(1);
}
console.log('Looks OK');
console.log('');
console.log('After deploy, verify:');
console.log('  curl -s https://mako.tekreminnovations.com/api/v1/health');
console.log('  curl -sI https://mako.tekreminnovations.com/ | head -3');
