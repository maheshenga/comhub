import { resolve } from 'node:path';

import type { PluginOption, ViteDevServer } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { viteEnvRestartKeys } from './plugins/vite/envRestartKeys';
import {
  sharedOptimizeDeps,
  sharedRendererDefine,
  sharedRendererPlugins,
  sharedRollupOutput,
} from './plugins/vite/sharedRendererConfig';
import { vercelSkewProtection } from './plugins/vite/vercelSkewProtection';

const isMobile = process.env.MOBILE === 'true';
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

const isDev = process.env.NODE_ENV !== 'production';
const platform = isMobile ? 'mobile' : 'web';
const disableViteMinify = process.env.DOCKER_BUILD_DISABLE_VITE_MINIFY === '1';
const workboxMaximumFileSizeToCacheInBytes = disableViteMinify
  ? 20 * 1024 * 1024
  : 10 * 1024 * 1024;
const appOnlyAliasSegments = [
  'business',
  'components',
  'config',
  'envs',
  'features',
  'hooks',
  'layout',
  'libs',
  'locales',
  'server',
  'services',
  'store',
  'styles',
];
const localWorkspacePackageAliases = [
  {
    find: /^@lobechat\/const$/,
    replacement: resolve(__dirname, 'packages/const/src/index.ts'),
  },
  {
    find: /^@lobechat\/const\/currency$/,
    replacement: resolve(__dirname, 'packages/const/src/currency.ts'),
  },
];
const tsconfigFallbackAliasSegments = [
  ['const', ['packages/const/src', 'src/const']],
  ['database', ['packages/database/src', 'src/database']],
  ['types', ['packages/types/src', 'src/types']],
  ['utils', ['packages/utils/src', 'src/utils']],
] as const;

const viteTsconfigFallbackAlias = (): PluginOption => ({
  name: 'lobe-vite-tsconfig-fallback-alias',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    for (const [segment, targets] of tsconfigFallbackAliasSegments) {
      const prefix = `@/${segment}`;

      if (!source.startsWith(prefix) || (source.length > prefix.length && source[prefix.length] !== '/')) {
        continue;
      }

      const suffix = source.slice(prefix.length);

      for (const target of targets) {
        const resolved = await this.resolve(resolve(__dirname, `${target}${suffix}`), importer, {
          ...options,
          skipSelf: true,
        });

        if (resolved) return resolved;
      }
    }

    return null;
  },
});

export default defineConfig({
  base: isDev ? '/' : process.env.VITE_CDN_BASE || '/_spa/',
  build: {
    minify: disableViteMinify ? false : 'esbuild',
    outDir: isMobile ? 'dist/mobile' : 'dist/desktop',
    reportCompressedSize: false,
    rollupOptions: {
      input: resolve(__dirname, isMobile ? 'index.mobile.html' : 'index.html'),
      output: sharedRollupOutput,
    },
  },
  define: sharedRendererDefine({ isMobile, isElectron: false }),
  optimizeDeps: sharedOptimizeDeps,
  resolve: {
    alias: [
      ...localWorkspacePackageAliases,
      ...appOnlyAliasSegments.map((segment) => ({
        find: new RegExp(`^@/${segment}(?=/|$)`),
        replacement: resolve(__dirname, `src/${segment}`),
      })),
    ],
  },
  plugins: [
    viteTsconfigFallbackAlias(),
    vercelSkewProtection(),
    viteEnvRestartKeys(['APP_URL']),
    ...sharedRendererPlugins({ platform }),

    isDev && {
      name: 'lobe-dev-proxy-print',
      configureServer(server: ViteDevServer) {
        const ONLINE_HOST = 'https://app.lobehub.com';
        const c = {
          green: (s: string) => `\x1B[32m${s}\x1B[0m`,
          bold: (s: string) => `\x1B[1m${s}\x1B[0m`,
          cyan: (s: string) => `\x1B[36m${s}\x1B[0m`,
        };
        const { info } = server.config.logger;
        return () => {
          server.printUrls = () => {
            const urls = server.resolvedUrls;
            if (!urls?.local?.[0]) return;
            const localHost = urls.local[0].replace(/\/$/, '');
            const proxyUrl = `${ONLINE_HOST}/_dangerous_local_dev_proxy?debug-host=${encodeURIComponent(localHost)}`;
            const colorUrl = (url: string) =>
              c.cyan(url.replace(/:(\d+)\//, (_, port) => `:${c.bold(port)}/`));
            info(`  ${c.green('➜')}  ${c.bold('Debug Proxy')}: ${colorUrl(proxyUrl)}`);
          };
        };
      },
    },

    VitePWA({
      injectRegister: null,
      manifest: false,
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // Docker builds can intentionally skip minification to reduce build pressure,
        // which makes the largest desktop bundle exceed Workbox's default size guard.
        maximumFileSizeToCacheInBytes: workboxMaximumFileSizeToCacheInBytes,
        runtimeCaching: [
          {
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          },
          {
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365, maxEntries: 30 },
            },
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          },
          {
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'image-assets',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30, maxEntries: 100 },
            },
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|avif)$/i,
          },
          {
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxAgeSeconds: 60 * 5, maxEntries: 50 },
            },
            urlPattern: /\/(api|trpc)\/.*/i,
          },
        ],
      },
    }),
  ].filter(Boolean) as PluginOption[],

  server: {
    cors: true,
    port: 9876,
    host: true,
    proxy: {
      '/api': `http://localhost:${process.env.PORT || 3010}`,
      '/oidc': `http://localhost:${process.env.PORT || 3010}`,
      '/trpc': `http://localhost:${process.env.PORT || 3010}`,
      '/webapi': `http://localhost:${process.env.PORT || 3010}`,
    },
    warmup: {
      clientFiles: [
        // src/ business code
        './src/initialize.ts',
        './src/spa/**/*.tsx',
        './src/business/**/*.{ts,tsx}',
        './src/components/**/*.{ts,tsx}',
        './src/config/**/*.ts',
        './src/const/**/*.ts',
        './src/envs/**/*.ts',
        './src/features/**/*.{ts,tsx}',
        './src/helpers/**/*.ts',
        './src/hooks/**/*.{ts,tsx}',
        './src/layout/**/*.{ts,tsx}',
        './src/libs/**/*.{ts,tsx}',
        './src/locales/**/*.ts',
        './src/routes/**/*.{ts,tsx}',
        './src/services/**/*.ts',
        './src/store/**/*.{ts,tsx}',
        './src/styles/**/*.ts',
        './src/utils/**/*.{ts,tsx}',

        // monorepo packages
        './packages/types/src/**/*.ts',
        './packages/const/src/**/*.ts',
        './packages/utils/src/**/*.ts',
        './packages/context-engine/src/**/*.ts',
        './packages/prompts/src/**/*.ts',
        './packages/model-bank/src/**/*.ts',
        './packages/model-runtime/src/**/*.ts',
        './packages/agent-runtime/src/**/*.ts',
        './packages/conversation-flow/src/**/*.ts',
        './packages/electron-client-ipc/src/**/*.ts',
        './packages/builtin-agents/src/**/*.ts',
        './packages/builtin-skills/src/**/*.ts',
        './packages/builtin-tool-*/src/**/*.ts',
        './packages/builtin-tools/src/**/*.ts',
        './packages/business/*/src/**/*.ts',
        './packages/config/src/**/*.ts',
        './packages/edge-config/src/**/*.ts',
        './packages/editor-runtime/src/**/*.ts',
        './packages/fetch-sse/src/**/*.ts',
        './packages/desktop-bridge/src/**/*.ts',
        './packages/python-interpreter/src/**/*.ts',
        './packages/agent-manager-runtime/src/**/*.ts',
      ],
    },
  },
});
