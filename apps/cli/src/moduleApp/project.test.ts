import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { startModuleAppDevServer } from './devServer';
import type { ModuleAppProjectError } from './project';
import {
  initializeModuleAppProject,
  packModuleAppProject,
  validateModuleAppProject,
} from './project';

describe('Module App project tools', () => {
  it('initializes, validates, and packages a safe v2 project', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'module-app-cli-'));
    const directory = path.join(parent, 'sample-app');
    await initializeModuleAppProject({ directory, displayName: 'Sample App' });

    await expect(validateModuleAppProject(directory)).resolves.toMatchObject({
      manifest: { app: { slug: 'sample-app' }, manifestVersion: 2 },
    });
    const packed = await packModuleAppProject({ directory });
    const entries = unzipSync(await readFile(packed.output));
    expect(Object.keys(entries).sort()).toEqual(['dist/index.html', 'module-app.yaml']);
  });

  it('rejects an invalid manifest before packaging', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'module-app-cli-invalid-'));
    await writeFile(path.join(directory, 'module-app.yaml'), 'manifestVersion: 2\n');

    await expect(validateModuleAppProject(directory)).rejects.toMatchObject<ModuleAppProjectError>({
      code: 'MODULE_APP_MANIFEST_INVALID',
    });
  });

  it('rejects symbolic links instead of silently omitting them', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'module-app-cli-link-'));
    const directory = path.join(parent, 'linked-app');
    await initializeModuleAppProject({ directory, displayName: 'Linked App' });
    await symlink(
      path.join(directory, 'dist', 'index.html'),
      path.join(directory, 'linked-index.html'),
      'file',
    );

    await expect(packModuleAppProject({ directory })).rejects.toMatchObject<ModuleAppProjectError>({
      code: 'MODULE_APP_PACKAGE_FILE_TYPE_UNSUPPORTED',
    });
  });

  it('serves the generated application through the local SDK bridge host', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'module-app-cli-dev-'));
    const directory = path.join(parent, 'preview-app');
    await initializeModuleAppProject({ directory, displayName: 'Preview "App"' });
    const server = await startModuleAppDevServer({ directory, port: 0 });

    try {
      const host = await fetch(server.url);
      expect(host.status).toBe(200);
      const hostHtml = await host.text();
      expect(hostHtml).toContain('comhub.module-app-sdk.v1');
      expect(hostHtml).toContain('<iframe id="module-app"></iframe>');
      expect(hostHtml).toContain('frame.title="Preview \\"App\\"";');
      const app = await fetch(`${server.url}/__module_app_files/index.html`);
      expect(app.status).toBe(200);
      expect(await app.text()).toContain('Preview &quot;App&quot;');
    } finally {
      await server.close();
    }
  });
});
