import { resolve } from 'node:path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths({ projects: [resolve(__dirname, '../../tsconfig.json')] })],
  test: {
    alias: {
      '@/business/server': resolve(__dirname, '../../packages/business-server/src'),
      '@/business': resolve(__dirname, '../../src/business'),
      '@/config': resolve(__dirname, '../../packages/app-config/src'),
      '@/const/aboutLinks': resolve(__dirname, '../../src/const/aboutLinks.ts'),
      '@/const/avatarPresets': resolve(__dirname, '../../src/const/avatarPresets.ts'),
      '@/const/brand': resolve(__dirname, '../../src/const/brand.ts'),
      '@/const/defaultAgent': resolve(__dirname, '../../packages/const/src/defaultAgent.ts'),
      '@/const/expertPlaza': resolve(__dirname, '../../src/const/expertPlaza.ts'),
      '@/database': resolve(__dirname, '../../packages/database/src'),
      '@/libs/trpc': resolve(__dirname, '../../packages/trpc/src'),
      '@/server/globalConfig': resolve(__dirname, '../../apps/server/src/globalConfig'),
      '@/server/modules': resolve(__dirname, '../../apps/server/src/modules'),
      '@/server/routers': resolve(__dirname, '../../apps/server/src/routers'),
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
