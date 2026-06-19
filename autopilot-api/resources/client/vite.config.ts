import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

/** Workbox precache size cap (4 GiB) — default is 2 MiB */
const WORKBOX_MAX_PRECACHE_BYTES = 4 * 1024 * 1024 * 1024;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Standalone `npm run dev` in resources/client is optional — default dev is `yarn dev` on Nest (:4000).
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // Set DISABLE_PWA=true only for local builds that must skip the service worker.
      disable: process.env.DISABLE_PWA === "true",
      registerType: "prompt",
      // Don't fail production builds when a chunk exceeds Workbox precache limit
      showMaximumFileSizeToCacheInBytesWarning: true,
      includeAssets: ["favicon.ico", "favicon.svg", "mako-logo.png"],
      workbox: {
        // Precache large production bundles (default Workbox limit is 2 MiB)
        maximumFileSizeToCacheInBytes: WORKBOX_MAX_PRECACHE_BYTES,
        // SPA shell for client routes only — never intercept OAuth/API navigations
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/documentation/, /^\/admin/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Supabase API — network first, fall back to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Static assets (Supabase Storage images)
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      manifest: {
        name: "Mako",
        short_name: "Mako",
        description: "AI-powered social media content generation, publishing, and lead management.",
        theme_color: "#E5A024",
        background_color: "#220044",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        categories: ["business", "productivity"],
        icons: [
          { src: "mako-logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "mako-logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        screenshots: [],
        shortcuts: [
          { name: "New Content",    url: "/content",  description: "Generate new AI content" },
          { name: "View Leads",     url: "/leads",    description: "Manage your leads"        },
          { name: "Media Library",  url: "/media",    description: "Browse media assets"      },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // @react-three/drei/VideoTexture — ensure ESM entry exists (partial installs omit dist/*.mjs)
      "hls.js": path.resolve(__dirname, "node_modules/hls.js/dist/hls.mjs"),
    },
  },
  optimizeDeps: {
    include: ["hls.js"],
  },
  build: {
    outDir: path.resolve(__dirname, "../../client/dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("three") || id.includes("@react-three")) return "three-vendor";
          if (id.includes("recharts") || id.includes("d3-")) return "charts-vendor";
          if (
            id.includes("@tiptap") ||
            id.includes("prosemirror") ||
            id.includes("@uiw/react-md-editor")
          ) {
            return "editor-vendor";
          }
          if (id.includes("@radix-ui")) return "radix-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
        },
      },
    },
  },
}));
