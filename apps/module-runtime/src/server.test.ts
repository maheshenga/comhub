import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModuleAppRuntimeInvoker } from './invocation';
import { createModuleAppRuntimeServer, isModuleAppRuntimeMain } from './server';

const createInvoker = () =>
  new ModuleAppRuntimeInvoker({
    launcher: { invoke: vi.fn() },
  });

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe('createModuleAppRuntimeServer', () => {
  it.each([
    { internalToken: '', runtimeJwks: '{"keys":[]}' },
    { internalToken: 'internal-token', runtimeJwks: '' },
  ])('rejects incomplete runtime credentials', (credentials) => {
    expect(() =>
      createModuleAppRuntimeServer({
        ...credentials,
        invoker: createInvoker(),
      }),
    ).toThrow('MODULE_APP_RUNTIME_CONFIG_MISSING');
  });

  it('recognizes the current module through a filesystem entry path', () => {
    expect(isModuleAppRuntimeMain(import.meta.url, fileURLToPath(import.meta.url))).toBe(true);
  });

  it('serves immutable public assets only from a content-addressed artifact directory', async () => {
    const artifactRoot = path.join(tmpdir(), `module-runtime-${crypto.randomUUID()}`);
    temporaryRoots.push(artifactRoot);
    const artifactSha256 = 'a'.repeat(64);
    const assetDirectory = path.join(artifactRoot, artifactSha256, 'dist');
    await mkdir(assetDirectory, { recursive: true });
    await writeFile(path.join(assetDirectory, 'index.html'), '<!doctype html><title>Jobs</title>');
    const server = createModuleAppRuntimeServer({
      artifactRoot,
      internalToken: 'internal-token',
      invoker: createInvoker(),
      runtimeJwks: '{"keys":[]}',
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test_server_address_missing');

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/artifacts/${artifactSha256}/dist/index.html`,
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain('<title>Jobs</title>');
      expect(response.headers.get('cache-control')).toContain('immutable');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
