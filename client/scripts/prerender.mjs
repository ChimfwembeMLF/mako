/**
 * Runs after `vite build`. Renders the public legal pages to static HTML and
 * writes dist/<route>/index.html, so crawlers that don't run JavaScript
 * (Meta Business Verification, App Review, Google OAuth review) see the full
 * text. nginx `try_files $uri $uri/ /index.html` serves these files first;
 * the SPA then boots on top as usual.
 */
import { build } from 'vite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrOut = path.join(root, 'dist-prerender');

const escapeAttr = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function setMeta(html, { title, description }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`);
}

function setRoot(html, body) {
  const start = html.indexOf('<div id="root">');
  const end = html.indexOf('<!--/root-->');
  if (start === -1 || end === -1) {
    throw new Error('index.html must contain <div id="root"> … <!--/root-->');
  }
  return `${html.slice(0, start)}<div id="root">${body}</div>${html.slice(end)}`;
}

await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  mode: 'production',
  logLevel: 'warn',
  build: {
    ssr: 'src/entry-prerender.tsx',
    outDir: ssrOut,
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: undefined } },
  },
});

const { renderHome, renderPages } = await import(
  pathToFileURL(path.join(ssrOut, 'entry-prerender.js')).href
);
const indexPath = path.join(dist, 'index.html');
const template = await readFile(indexPath, 'utf8');

// Home page (also the SPA fallback): a short crawler-readable summary.
await writeFile(indexPath, setRoot(template, renderHome()));
console.log('prerendered / (summary)');

for (const page of renderPages()) {
  const html = setRoot(setMeta(template, page), page.html);
  const dir = path.join(dist, page.route.replace(/^\//, ''));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
  console.log(`prerendered ${page.route} (${Math.round(html.length / 1024)} KB)`);
}

await rm(ssrOut, { recursive: true, force: true });
