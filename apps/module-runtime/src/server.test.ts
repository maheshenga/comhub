import { mkdir, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModuleAppRuntimeInvoker } from './invocation';
import {
  createModuleAppRuntimeServer,
  isModuleAppRuntimeMain,
  startModuleAppRuntimeServerFromEnv,
} from './server';

const createInvoker = () =>
  new ModuleAppRuntimeInvoker({
    launcher: { invoke: vi.fn() },
  });

const temporaryRoots: string[] = [];

const requestServer = (
  url: string,
  options: { body?: string; headers?: Record<string, string>; method?: string } = {},
) =>
  new Promise<{ body: string; headers: NodeJS.Dict<string | string[]>; status: number }>(
    (resolve, reject) => {
      const request = httpRequest(
        url,
        { headers: options.headers, method: options.method ?? 'GET' },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.once('end', () =>
            resolve({
              body: Buffer.concat(chunks).toString('utf8'),
              headers: response.headers,
              status: response.statusCode ?? 0,
            }),
          );
        },
      );
      request.once('error', reject);
      request.end(options.body);
    },
  );

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe('createModuleAppRuntimeServer', () => {
  it('exposes a secret-free health check without invocation authorization', async () => {
    const server = createModuleAppRuntimeServer({
      internalToken: 'internal-token',
      invoker: createInvoker(),
      runtimeJwks: '{"keys":[]}',
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test_server_address_missing');

    try {
      const response = await requestServer(`http://127.0.0.1:${address.port}/health`);
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
      expect(response.body).not.toContain('internal-token');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('keeps health available while invocation mutations are disabled', async () => {
    const launcher = { invoke: vi.fn() };
    const server = createModuleAppRuntimeServer({
      internalToken: '',
      invocationEnabled: false,
      invoker: new ModuleAppRuntimeInvoker({ launcher }),
      runtimeJwks: '',
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test_server_address_missing');

    try {
      const health = await requestServer(`http://127.0.0.1:${address.port}/health`);
      expect(health.status).toBe(200);
      const invocation = await requestServer(
        `http://127.0.0.1:${address.port}/v1/invocations`,
        { body: '{}', method: 'POST' },
      );
      expect(invocation.status).toBe(503);
      expect(JSON.parse(invocation.body)).toEqual({
        error: 'MODULE_APP_RUNTIME_INVOCATION_DISABLED',
      });
      expect(launcher.invoke).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('starts a health-only server without runtime credentials or images when disabled', async () => {
    vi.stubEnv('MODULE_APP_EXECUTION_ENABLED', 'false');
    vi.stubEnv('MODULE_APP_RUNTIME_INVOCATION_ENABLED', 'false');
    vi.stubEnv('MODULE_APP_RUNTIME_INTERNAL_TOKEN', '');
    vi.stubEnv('MODULE_APP_RUNTIME_JWKS', '');
    vi.stubEnv('MODULE_APP_RUNTIME_NODE22_IMAGE', '');
    vi.stubEnv('MODULE_APP_RUNTIME_PYTHON312_IMAGE', '');
    vi.stubEnv('PORT', '0');

    let server: ReturnType<typeof startModuleAppRuntimeServerFromEnv> | undefined;
    try {
      server = startModuleAppRuntimeServerFromEnv();
      await new Promise<void>((resolve) => server!.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test_server_address_missing');

      const response = await requestServer(`http://127.0.0.1:${address.port}/health`);
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
    } finally {
      vi.unstubAllEnvs();
      if (server) {
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve())),
        );
      }
    }
  });

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

  it('binds invocation verification to the requested artifact hash', async () => {
    const artifactSha256 = 'a'.repeat(64);
    const verifyCapability = vi.fn().mockResolvedValue({ artifactSha256, surface: 'runtime' });
    const launcher = { invoke: vi.fn().mockResolvedValue({}) };
    const server = createModuleAppRuntimeServer({
      internalToken: 'internal-token',
      invoker: new ModuleAppRuntimeInvoker({ launcher }),
      runtimeJwks: '{"keys":[]}',
      verifyCapability,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test_server_address_missing');

    try {
      const response = await requestServer(`http://127.0.0.1:${address.port}/v1/invocations`, {
        body: JSON.stringify({
          artifactSha256,
          capability: 'signed-runtime-capability',
          entry: 'server/search.js',
          input: { query: 'jobs' },
          invocationId: '00000000-0000-4000-8000-000000000001',
          runtime: 'node22',
          timeoutMs: 1000,
        }),
        headers: {
          authorization: 'Bearer internal-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(verifyCapability).toHaveBeenCalledWith(
        'signed-runtime-capability',
        '{"keys":[]}',
        { artifactSha256 },
      );
      expect(launcher.invoke).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
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
      const response = await requestServer(
        `http://127.0.0.1:${address.port}/artifacts/${artifactSha256}/dist/index.html`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toContain('<title>Jobs</title>');
      expect(response.headers['cache-control']).toContain('immutable');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
