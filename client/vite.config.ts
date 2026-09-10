import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve hls.js from either:
 * - resources/client/node_modules
 * - monorepo root node_modules
 */
function resolveHlsJsEntry(): string {
  const candidates = [
    path.resolve(__dirname, "node_modules/hls.js/dist/hls.mjs"),
    path.resolve(__dirname, "../node_modules/hls.js/dist/hls.mjs"),
  ];

  const resolved = candidates.find(existsSync);

  if (!resolved) {
    throw new Error(
      "Could not find hls.js. Run: yarn add hls.js"
    );
  }

  return resolved;
}

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  const backendPort = Number(process.env.BACKEND_PORT) || 4000;

  return {
    server: {
      port: Number(process.env.VITE_PORT) || 5173,
      proxy: isDevelopment
        ? {
            "/api": { target: `http://localhost:${backendPort}`, changeOrigin: true },
            "/uploads": { target: `http://localhost:${backendPort}`, changeOrigin: true },
            "/documentation": { target: `http://localhost:${backendPort}`, changeOrigin: true },
            "/docs": { target: `http://localhost:${backendPort}`, changeOrigin: true },
          }
        : undefined,
    },


    plugins: [
      react(),
      ...(isDevelopment ? [componentTagger()] : []),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
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
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (
              id.includes("/three/") ||
              id.includes("\\three\\") ||
              id.includes("@react-three")
            ) {
              return "three-vendor";
            }

            if (
              id.includes("/recharts/") ||
              id.includes("\\recharts\\") ||
              id.includes("/d3-") ||
              id.includes("\\d3-")
            ) {
              return "charts-vendor";
            }

            if (
              id.includes("@tiptap") ||
              id.includes("prosemirror") ||
              id.includes("@uiw/react-md-editor")
            ) {
              return "editor-vendor";
            }

            if (id.includes("@radix-ui")) {
              return "radix-vendor";
            }

            // Do not manually split lucide-react.
            // This avoids Rollup chunk-order/runtime issues with icons.
            return undefined;
          },
        },
      },
    },
  };
});
