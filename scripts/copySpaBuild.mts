import path from 'node:path';

import { copySpaBuild } from './copySpaBuildCore.mjs';

const root = path.resolve(import.meta.dirname, '..');
const targets = [
  { distDir: 'desktop', publicDir: 'public/_spa' },
  { distDir: 'mobile', publicDir: 'public/_spa' },
  { distDir: 'auth', publicDir: 'public/_spa-auth' },
] as const;

copySpaBuild(root, targets);
