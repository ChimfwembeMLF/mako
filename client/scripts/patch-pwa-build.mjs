#!/usr/bin/env node
/**
 * Patches vite.config.ts so Workbox allows large JS bundles in precache.
 * Run on the server if git pull hasn't updated vite.config.ts yet:
 *   node scripts/patch-pwa-build.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "vite.config.ts");

if (!fs.existsSync(configPath)) {
  console.error("vite.config.ts not found at", configPath);
  process.exit(1);
}

let src = fs.readFileSync(configPath, "utf8");

if (src.includes("maximumFileSizeToCacheInBytes")) {
  console.log("vite.config.ts already has maximumFileSizeToCacheInBytes — no patch needed.");
  process.exit(0);
}

if (!src.includes("VitePWA({") || !src.includes("workbox:")) {
  console.error("Unexpected vite.config.ts format — patch manually.");
  process.exit(1);
}

if (!src.includes("WORKBOX_MAX_PRECACHE_BYTES")) {
  src = src.replace(
    /import \{ VitePWA \} from "vite-plugin-pwa";\n/,
    `import { VitePWA } from "vite-plugin-pwa";\n\n/** Workbox precache size cap (4 GiB) — default is 2 MiB */\nconst WORKBOX_MAX_PRECACHE_BYTES = 4 * 1024 * 1024 * 1024;\n`,
  );
}

if (!src.includes("showMaximumFileSizeToCacheInBytesWarning")) {
  src = src.replace(
    "VitePWA({",
    `VitePWA({
      showMaximumFileSizeToCacheInBytesWarning: true,`,
  );
}

src = src.replace(
  /workbox:\s*\{/,
  `workbox: {
        maximumFileSizeToCacheInBytes: WORKBOX_MAX_PRECACHE_BYTES,`,
);

fs.writeFileSync(configPath, src);
console.log("Patched vite.config.ts — run: yarn build");
