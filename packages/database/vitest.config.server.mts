import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'raw-md',
      transform(_, id) {
        if (id.endsWith('.md')) return { code: 'export default ""', map: null };
      },
    },
  ],
  test: {
    alias: [
      // `@/server/services/appSettings` (under src/server) pulls `@/const/appSettingsRegistry`,
      // which only exists under the repo-root src/const (not packages/const) — pin the
      // exact file before the directory-level `@/const` alias.
      {
        find: '@/const/appSettingsRegistry',
        replacement: resolve(__dirname, '../../src/const/appSettingsRegistry.ts'),
      },
      { find: '@/const', replacement: resolve(__dirname, '../const/src') },
      { find: '@/business/server', replacement: resolve(__dirname, '../business-server/src') },
      {
        find: '@/utils/errorResponse',
        replacement: resolve(__dirname, '../../src/utils/errorResponse'),
      },
      { find: '@/utils', replacement: resolve(__dirname, '../utils/src') },
      { find: '@/database', replacement: resolve(__dirname, '../database/src') },
      { find: '@/libs/model-runtime', replacement: resolve(__dirname, '../model-runtime/src') },
      { find: '@/types', replacement: resolve(__dirname, '../types/src') },
      { find: '@/config', replacement: resolve(__dirname, '../app-config/src') },
      { find: '@/envs', replacement: resolve(__dirname, '../env/src') },
      { find: '@/libs/trpc', replacement: resolve(__dirname, '../trpc/src') },
      { find: '@/locales', replacement: resolve(__dirname, '../locales/src') },
      {
        find: '@/server/services/appSettings',
        replacement: resolve(__dirname, '../../src/server/services/appSettings'),
      },
      { find: '@/server/services', replacement: resolve(__dirname, '../../apps/server/src/services') },
      { find: '@/server/modules', replacement: resolve(__dirname, '../../apps/server/src/modules') },
      { find: '@', replacement: resolve(__dirname, '../../src') },
    ],
    coverage: {
      exclude: [
        // https://github.com/lobehub/lobe-chat/pull/7265
        // Vitest 4+ ships an empty `coverageConfigDefaults.exclude`; keep the previous
        // default exclusions explicitly so the coverage set does not silently grow.
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
        'src/server/core/dbForTest.ts',
      ],
      include: ['src/models/**/*.ts', 'src/server/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'text-summary'],
    },
    env: {
      TEST_SERVER_DB: '1',
    },
    environment: 'node',
    // Shared test-DB bootstrap (getTestDB) can exceed the 10s hook default when
    // the full src/models suite runs in parallel.
    hookTimeout: 30_000,
    testTimeout: 30_000,
    isolate: false,
    maxWorkers: 1,
    setupFiles: './tests/setup-db.ts',
  },
});
