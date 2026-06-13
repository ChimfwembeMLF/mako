import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

/** Workbox precache size cap (4 GiB) — default is 2 MiB */
const WORKBOX_MAX_PRECACHE_BYTES = 4 * 1024 * 1024 * 1024;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      disable: process.env.DISABLE_PWA === "true",
      registerType: "autoUpdate",
      // Don't fail production builds when a chunk exceeds Workbox precache limit
      showMaximumFileSizeToCacheInBytesWarning: true,
      includeAssets: ["favicon.ico", "icons/*.png"],
      workbox: {
        // Precache large production bundles (default Workbox limit is 2 MiB)
        maximumFileSizeToCacheInBytes: WORKBOX_MAX_PRECACHE_BYTES,
        // Cache strategy: app shell + API responses
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
        name: "Mako — AI Marketing",
        short_name: "Mako",
        description: "AI-powered social media content generation and lead management.",
        theme_color: "#6366f1",
        background_color: "#0f0f12",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        categories: ["business", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
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
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
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
