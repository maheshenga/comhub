import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const copyDirs = ['assets', 'i18n', 'vendor'] as const;
const targets = [
  { distDir: 'desktop', publicDir: 'public/_spa' },
  { distDir: 'mobile', publicDir: 'public/_spa' },
  { distDir: 'auth', publicDir: 'public/_spa-auth' },
] as const;

for (const { distDir, publicDir } of targets) {
  const spaDir = path.resolve(root, publicDir);
  mkdirSync(spaDir, { recursive: true });

  for (const dir of copyDirs) {
    rmSync(path.resolve(spaDir, dir), { force: true, recursive: true });

    const sourceDir = path.resolve(root, `dist/${distDir}/${dir}`);
    const targetDir = path.resolve(spaDir, dir);

    if (!existsSync(sourceDir)) continue;

    cpSync(sourceDir, targetDir, { recursive: true });
    console.log(`Copied dist/${distDir}/${dir} -> ${publicDir}/${dir}`);
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
}
