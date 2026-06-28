import { resolve } from 'node:path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths({ projects: [resolve(__dirname, '../../tsconfig.json')] })],
  test: {
    alias: {
      '@/business/server': resolve(__dirname, '../../packages/business-server/src'),
      '@/business': resolve(__dirname, '../../src/business'),
      '@/database': resolve(__dirname, '../../packages/database/src'),
      '@/libs/trpc': resolve(__dirname, '../../packages/trpc/src'),
      '@/server': resolve(__dirname, '../../src/server'),
      '@/types': resolve(__dirname, '../../packages/types/src'),
      '@/utils': resolve(__dirname, '../../src/utils'),
      '@': resolve(__dirname, '../../src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'text-summary'],
    },
    environment: 'node',
  },
});
