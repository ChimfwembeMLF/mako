import { cpSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, '..', 'autopilot-client', 'public', 'widget');

mkdirSync(dest, { recursive: true });
cpSync(join(root, 'dist', 'v1'), join(dest, 'v1'), { recursive: true });
console.log('Copied widget bundle to autopilot-client/public/widget/v1/');
