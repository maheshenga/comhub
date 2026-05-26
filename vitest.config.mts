import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';

const alias = {
  // Downstream workspaces sometimes pnpm-override @lobechat/business-* packages to
  // internal implementations whose source files import alias paths that only exist
  // in the outer workspace, causing vite import-analysis to fail when running tests
  // from this repo. Pin the package to the local stub so tests here stay hermetic.
  '@lobechat/business-model-runtime': resolve(
    __dirname,
    './packages/business/model-runtime/src/index.ts',
  ),
  '@emoji-mart/data': resolve(__dirname, './tests/mocks/emojiMartData.ts'),
  '@emoji-mart/react': resolve(__dirname, './tests/mocks/emojiMartReact.tsx'),
  '@/database/_deprecated': resolve(__dirname, './src/database/_deprecated'),
  '@/const/url': resolve(__dirname, './packages/const/src/url.ts'),
  '@/utils/client/switchLang': resolve(__dirname, './src/utils/client/switchLang'),
  '@/const/locale': resolve(__dirname, './src/const/locale'),
  // TODO: after refactor the errorResponse, we can remove it
  '@/utils/errorResponse': resolve(__dirname, './src/utils/errorResponse'),
  '@/utils/unzipFile': resolve(__dirname, './src/utils/unzipFile'),
  '@/utils/server': resolve(__dirname, './src/utils/server'),
  '@/utils/identifier': resolve(__dirname, './src/utils/identifier'),
  '@/utils/electron': resolve(__dirname, './src/utils/electron'),
  '@/utils/env': resolve(__dirname, './packages/utils/src/env.ts'),
  '@/utils/markdownToTxt': resolve(__dirname, './src/utils/markdownToTxt'),
  '@/utils/sanitizeFileName': resolve(__dirname, './src/utils/sanitizeFileName'),
  '@/libs/trpc/client/lambda': resolve(__dirname, './src/libs/trpc/client/lambda.ts'),
  '@/libs/trpc/client': resolve(__dirname, './src/libs/trpc/client/index.ts'),
  '@/locales/default/subscription': resolve(__dirname, './src/locales/default/subscription.ts'),
  '@/store/user/selectors': resolve(__dirname, './src/store/user/selectors.ts'),
  '@/store/user/slices/auth/selectors': resolve(
    __dirname,
    './src/store/user/slices/auth/selectors.ts',
  ),
  '@/store/user/slices/settings/selectors': resolve(
    __dirname,
    './src/store/user/slices/settings/selectors/index.ts',
  ),
  '@/store/user/store': resolve(__dirname, './src/store/user/store.ts'),
  '@/store/user': resolve(__dirname, './src/store/user/index.ts'),
  '~test-utils': resolve(__dirname, './tests/utils.tsx'),
  'lru_map': resolve(__dirname, './tests/mocks/lru_map'),
};

const resolveFile = (base: string) => {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.mts'),
    join(base, 'index.cts'),
    join(base, 'index.js'),
    join(base, 'index.jsx'),
  ];

  return candidates.find((candidate) => {
    if (!existsSync(candidate)) return false;

    return statSync(candidate).isFile();
  });
};

const resolveWorkspaceAlias = (id: string) => {
  if (!id.startsWith('@/')) return;

  const name = id.slice(2);
  const [scope, ...restParts] = name.split('/');
  const rest = restParts.join('/');
  const scopedPackageRoots: Record<string, string> = {
    const: './packages/const/src',
    database: './packages/database/src',
    types: './packages/types/src',
    utils: './packages/utils/src',
  };

  const roots = scopedPackageRoots[scope]
    ? [join(__dirname, scopedPackageRoots[scope], rest), join(__dirname, './src', name)]
    : [join(__dirname, './src', name)];

  for (const root of roots) {
    const resolved = resolveFile(root);
    if (resolved) return resolved;
  }
};

export default defineConfig({
  define: {
    '__CI__': process.env.CI === 'true' ? 'true' : 'false',
    '__DEV__': process.env.NODE_ENV !== 'production' ? 'true' : 'false',
    '__ELECTRON__': 'false',
    '__MOBILE__': 'false',
    '__TEST__': 'true',
  },
  optimizeDeps: {
    exclude: ['crypto', 'util', 'tty'],
    include: ['@lobehub/tts'],
  },
  plugins: [
    {
      enforce: 'pre',
      name: 'comhub-workspace-aliases',
      resolveId(id) {
        return resolveWorkspaceAlias(id) ?? null;
      },
    },
    tsconfigPaths({ projects: ['.'] }),
    // Let `.md` imports resolve to their raw text content so Rollup/Vitest
    // doesn't try to parse Markdown as JavaScript.
    {
      name: 'raw-md',
      transform(_, id) {
        if (id.endsWith('.md')) return { code: 'export default ""', map: null };
      },
    },
    /**
     * @lobehub/fluent-emoji@4.0.0 ships `es/FluentEmoji/style.js` but its `es/FluentEmoji/index.js`
     * imports `./style/index.js` which doesn't exist.
     *
     * In app bundlers this can be tolerated/rewritten, but Vite/Vitest resolves it strictly and
     * fails the whole test run. Redirect it to the real file.
     */
    {
      enforce: 'pre',
      name: 'fix-lobehub-fluent-emoji-style-import',
      resolveId(id, importer) {
        if (!importer) return null;

        const isFluentEmojiEntry =
          importer.endsWith('/@lobehub/fluent-emoji/es/FluentEmoji/index.js') ||
          importer.includes('/@lobehub/fluent-emoji/es/FluentEmoji/index.js?');

        const isMissingStyleIndex =
          id === './style/index.js' ||
          id.endsWith('/@lobehub/fluent-emoji/es/FluentEmoji/style/index.js') ||
          id.endsWith('/@lobehub/fluent-emoji/es/FluentEmoji/style/index.js?') ||
          id.endsWith('/FluentEmoji/style/index.js') ||
          id.endsWith('/FluentEmoji/style/index.js?');

        if (isFluentEmojiEntry && isMissingStyleIndex)
          return resolve(dirname(importer), 'style.js');

        return null;
      },
    },
  ],
  resolve: {
    alias,
  },
  test: {
    alias,
    coverage: {
      all: false,
      exclude: [
        // https://github.com/lobehub/lobe-chat/pull/7265
        ...coverageConfigDefaults.exclude,
        '__mocks__/**',
        '**/packages/**',
        // just ignore the migration code
        // we will use pglite in the future
        // so the coverage of this file is not important
        'src/database/client/core/db.ts',
        'src/utils/fetch/fetchEventSource/*.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'text-summary'],
      reportsDirectory: './coverage/app',
    },
    environment: 'happy-dom',
    exclude: [
      '**/node_modules/**',
      '**/.*/**',
      '**/dist/**',
      '**/build/**',
      '**/tmp/**',
      '**/temp/**',
      '**/docs/**',
      '**/locales/**',
      '**/public/**',
      '**/apps/desktop/**',
      '**/apps/mobile/**',
      '**/apps/cli/**',
      '**/packages/**',
      '**/e2e/**',
    ],
    globals: true,
    server: {
      deps: {
        inline: [
          'vitest-canvas-mock',
          /@emoji-mart/,
          'emoji-mart',
          '@lobehub/ui',
          '@lobehub/fluent-emoji',
          '@pierre/diffs',
          '@pierre/diffs/react',
          'lru_map',
          'lexical',
          /@lexical\//,
          /@lobehub\//,
        ],
      },
    },
    setupFiles: join(__dirname, './tests/setup.ts'),
  },
});
