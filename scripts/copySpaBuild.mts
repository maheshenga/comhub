import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spaDir = path.resolve(root, 'public/_spa');
const distDirs = ['desktop', 'mobile'] as const;
const copyDirs = ['assets', 'i18n', 'vendor'] as const;

mkdirSync(spaDir, { recursive: true });

for (const dir of copyDirs) {
  rmSync(path.resolve(spaDir, dir), { force: true, recursive: true });
}

for (const distDir of distDirs) {
  for (const dir of copyDirs) {
    const sourceDir = path.resolve(root, `dist/${distDir}/${dir}`);
    const targetDir = path.resolve(spaDir, dir);

    if (!existsSync(sourceDir)) continue;

    cpSync(sourceDir, targetDir, { recursive: true });
    console.log(`Copied dist/${distDir}/${dir} -> public/_spa/${dir}`);
  }
}

writeFileSync(
  path.resolve(spaDir, 'sw.js'),
  `self.addEventListener('install', (event) => {
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
`,
);
