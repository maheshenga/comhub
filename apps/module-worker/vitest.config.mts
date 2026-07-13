import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@lobechat/database/models/moduleAppBuild',
        replacement: path.resolve(
          __dirname,
          '../../packages/database/src/models/moduleAppBuild.ts',
        ),
      },
      {
        find: '@lobechat/database/schemas',
        replacement: path.resolve(
          __dirname,
          '../../packages/database/src/schemas/index.ts',
        ),
      },
      {
        find: '@lobechat/database',
        replacement: path.resolve(
          __dirname,
          '../../packages/database/src/index.ts',
        ),
      },
      {
        find: '@lobechat/module-app-build',
        replacement: path.resolve(
          __dirname,
          '../../packages/module-app-build/src/index.ts',
        ),
      },
      {
        find: '@lobechat/types',
        replacement: path.resolve(
          __dirname,
          '../../packages/types/src/index.ts',
        ),
      },
    ],
  },
  test: {
    environment: 'node',
  },
});
