import { defineConfig } from 'vite';
import { resolve } from 'path';

const entries: Record<string, { file: string; name: string }> = {
  loader: { file: 'src/loader.ts', name: 'AutopilotWidget' },
  'avatar-3d': { file: 'src/avatar/panel-3d-entry.ts', name: 'AutopilotAvatar3d' },
  'ar-view': { file: 'src/avatar/ar-view-entry.ts', name: 'AutopilotArView' },
};

const entryKey = process.env.WIDGET_ENTRY || 'loader';
const entry = entries[entryKey] ?? entries.loader;

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, entry.file),
      formats: ['iife'],
      name: entry.name,
      fileName: () => `v1/${entryKey}.js`,
    },
    outDir: 'dist',
    emptyOutDir: entryKey === 'loader',
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true,
      },
    },
  },
});
