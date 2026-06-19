import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const copyDirs = ['assets', 'i18n', 'vendor'] as const;

export type SpaBuildCopyTarget = {
  distDir: string;
  publicDir: string;
};

const unregisterServiceWorker = `self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.navigate(client.url);
  })());
});
`;

export const copySpaBuild = (root: string, targets: readonly SpaBuildCopyTarget[]) => {
  const cleanedPublicDirs = new Set<string>();

  for (const { publicDir } of targets) {
    if (cleanedPublicDirs.has(publicDir)) continue;

    const spaDir = path.resolve(root, publicDir);
    mkdirSync(spaDir, { recursive: true });

    for (const dir of copyDirs) {
      rmSync(path.resolve(spaDir, dir), { force: true, recursive: true });
    }

    cleanedPublicDirs.add(publicDir);
  }

  for (const { distDir, publicDir } of targets) {
    const spaDir = path.resolve(root, publicDir);
    mkdirSync(spaDir, { recursive: true });

    for (const dir of copyDirs) {
      const sourceDir = path.resolve(root, `dist/${distDir}/${dir}`);
      const targetDir = path.resolve(spaDir, dir);

      if (!existsSync(sourceDir)) continue;

      cpSync(sourceDir, targetDir, { recursive: true });
      console.log(`Copied dist/${distDir}/${dir} -> ${publicDir}/${dir}`);
    }
  }

  for (const publicDir of cleanedPublicDirs) {
    writeFileSync(path.resolve(root, publicDir, 'sw.js'), unregisterServiceWorker);
  }
};
