import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { ModuleAppRuntimeInvoker } from './invocation';
import { createModuleAppRuntimeServer, isModuleAppRuntimeMain } from './server';

const createInvoker = () =>
  new ModuleAppRuntimeInvoker({
    launcher: { invoke: vi.fn() },
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
});
