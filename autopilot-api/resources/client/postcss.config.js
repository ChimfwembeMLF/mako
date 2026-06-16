import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: path.join(dir, 'tailwind.config.ts') },
    autoprefixer: {},
  },
};
