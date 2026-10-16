import path from 'node:path';

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
  optimizeDeps: {
    exclude: ['crypto', 'util', 'tty'],
    include: ['@lobehub/tts'],
  },
  test: {
    alias: [
      // `@/server/services/appSettings` (under src/server) pulls `@/const/appSettingsRegistry`,
      // which only exists under the repo-root src/const (not packages/const) — pin the
      // exact file before the directory-level `@/const` alias.
      {
        find: '@/const/appSettingsRegistry',
        replacement: path.resolve(__dirname, '../../src/const/appSettingsRegistry.ts'),
      },
      { find: '@/const', replacement: path.resolve(__dirname, '../const/src') },
      { find: '@/business/server', replacement: path.resolve(__dirname, '../business-server/src') },
      {
        find: '@/utils/errorResponse',
        replacement: path.resolve(__dirname, '../../src/utils/errorResponse'),
      },
      { find: '@/utils', replacement: path.resolve(__dirname, '../utils/src') },
      { find: '@/database', replacement: path.resolve(__dirname, '../database/src') },
      { find: '@/libs/model-runtime', replacement: path.resolve(__dirname, '../model-runtime/src') },
      { find: '@/types', replacement: path.resolve(__dirname, '../types/src') },
      { find: '@/config', replacement: path.resolve(__dirname, '../app-config/src') },
      { find: '@/envs', replacement: path.resolve(__dirname, '../env/src') },
      { find: '@/libs/trpc', replacement: path.resolve(__dirname, '../trpc/src') },
      { find: '@/locales', replacement: path.resolve(__dirname, '../locales/src') },
      {
        find: '@/server/services/appSettings',
        replacement: path.resolve(__dirname, '../../src/server/services/appSettings'),
      },
      {
        find: '@/server/services',
        replacement: path.resolve(__dirname, '../../apps/server/src/services'),
      },
      { find: '@/server/modules', replacement: path.resolve(__dirname, '../../apps/server/src/modules') },
      { find: '@', replacement: path.resolve(__dirname, '../../src') },
    ],
    coverage: {
      exclude: [
        'src/server/**',
        'src/repositories/dataImporter/deprecated/**',
        'src/types/**',
        'src/models/userMemory/sources/index.ts',
        'src/models/userMemory/sources/shared.ts',
        'src/models/ragEval/index.ts',
        'src/models/agentEval/index.ts',
        'src/repositories/userMemory/index.ts',
        'src/models/_template.ts',
        'src/models/__tests__/_test_template.ts',
        'src/models/web-server.ts',
        'src/core/web-server.ts',
        'src/core/db-adaptor.ts',
        'src/core/getTestDB.ts',
        'src/index.ts',
        'tests/**',
        'vitest.config*.mts',
      ],
      reporter: ['text', 'json'],
    },
    environment: 'happy-dom',
    exclude: [
      'node_modules/**/**',
      'src/server/**/**',
      'src/repositories/dataImporter/deprecated/**/**',
    ],
    server: {
      deps: {
        inline: ['vitest-canvas-mock'],
      },
    },
    setupFiles: path.resolve(__dirname, 'tests/setup-db.ts'),
  },
});
