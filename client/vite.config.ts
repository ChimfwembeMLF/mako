import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/** Monorepo: hls.js may live under client/ or repo root node_modules after yarn install. */
function resolveHlsJsEntry(): string {
  const candidates = [
    path.resolve(__dirname, "node_modules/hls.js/dist/hls.mjs"),
    path.resolve(__dirname, "../node_modules/hls.js/dist/hls.mjs"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/documentation": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/docs": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  // Standalone `npm run dev` in resources/client is optional — default dev is `yarn dev` on Nest (:4000).
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // @react-three/drei/VideoTexture — ensure ESM entry exists (partial installs omit dist/*.mjs)
      "hls.js": resolveHlsJsEntry(),
    },
  },
  optimizeDeps: {
    include: ["hls.js"],
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
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
          // Keep lucide-react in the graph (do not force icons-vendor).
          // Splitting it caused intermittent ReferenceError: <Icon> is not defined
          // when Rollup left bare icon identifiers in the entry chunk.
        },
      },
    },
  },
}));
