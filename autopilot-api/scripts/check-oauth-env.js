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

const keys = [
  'FRONTEND_URL',
  'API_PUBLIC_URL',
  'GOOGLE_CALLBACK_URL',
  'FACEBOOK_CALLBACK_URL',
  'LINKEDIN_CALLBACK_URL',
  'INSTAGRAM_CALLBACK_URL',
  'FACEBOOK_SOCIAL_CALLBACK_URL',
  'LINKEDIN_SOCIAL_CALLBACK_URL',
  'INSTAGRAM_SOCIAL_CALLBACK_URL',
  'WHATSAPP_SOCIAL_CALLBACK_URL',
];

console.log('=== OAuth env check ===');
console.log('NODE_ENV:', nodeEnv);
let bad = 0;
for (const key of keys) {
  const v = process.env[key]?.trim();
  if (!v) {
    console.log(`  ${key}: (missing)`);
    if (key.includes('SOCIAL') || key.includes('FRONTEND')) bad++;
    continue;
  }
  const flag = /localhost|127\.0\.0\.1/i.test(v) ? ' ← FIX (localhost)' : '';
  if (flag) bad++;
  console.log(`  ${key}: ${v}${flag}`);
}
console.log('');
console.log(bad ? `${bad} issue(s) — OAuth will fail until fixed` : 'Looks OK');
console.log('');
console.log('Test Google login route (expect HTTP 302):');
console.log('  curl -sI http://127.0.0.1:4005/api/v1/auth/google | head -3');
