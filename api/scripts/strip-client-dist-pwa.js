#!/usr/bin/env node
/**
 * Removes legacy PWA service worker files from client/dist.
 * They intercept /api OAuth navigations when Nest serves the SPA.
 */
const fs = require('fs');
const path = require('path');

const dest = path.resolve(__dirname, '../client/dist');

if (!fs.existsSync(path.join(dest, 'index.html'))) {
  console.error('[strip-client-dist-pwa] Missing build at', dest);
  process.exit(1);
}

for (const name of fs.readdirSync(dest)) {
  if (
    name === 'sw.js' ||
    name === 'sw.js.map' ||
    name === 'manifest.webmanifest' ||
    name.startsWith('workbox-')
  ) {
    fs.rmSync(path.join(dest, name), { force: true });
    console.log('[strip-client-dist-pwa] Removed', name);
  }
}

console.log('[strip-client-dist-pwa] Ready at', dest);
