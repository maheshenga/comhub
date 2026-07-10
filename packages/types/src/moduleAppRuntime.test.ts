import { describe, expect, it } from 'vitest';

import {
  moduleAppBuildProfileSchema,
  moduleAppCapabilityClaimsSchema,
  moduleAppExecutableRuntimeSchema,
} from './moduleAppRuntime';

describe('module app executable runtime contracts', () => {
  it('accepts only platform-managed build profiles and runtimes', () => {
    expect(moduleAppBuildProfileSchema.options).toEqual(['node22-static', 'python312-assets']);
    expect(
      moduleAppExecutableRuntimeSchema.parse({
        functions: [{ entry: 'server/search.ts', key: 'search', runtime: 'node22' }],
        permissions: ['data.read'],
      }),
    ).toMatchObject({
      functions: [{ entry: 'server/search.ts', key: 'search', runtime: 'node22' }],
    });

    expect(() =>
      moduleAppExecutableRuntimeSchema.parse({
        image: 'developer/custom:latest',
        permissions: [],
      }),
    ).toThrow();
  });

  it('requires installation-bound short-lived capability claims', () => {
    expect(
      moduleAppCapabilityClaimsSchema.parse({
        appId: '00000000-0000-4000-8000-000000000001',
        aud: 'module-runtime',
        exp: 1_700_000_300,
        iat: 1_700_000_000,
        installationId: '00000000-0000-4000-8000-000000000002',
        nonce: 'nonce-1234567890',
        permissions: ['data.read'],
        userId: 'user-1',
        versionId: '00000000-0000-4000-8000-000000000003',
      }),
    ).toMatchObject({ aud: 'module-runtime', surface: 'browser', userId: 'user-1' });

    expect(() =>
      moduleAppCapabilityClaimsSchema.parse({
        appId: '00000000-0000-4000-8000-000000000001',
        aud: 'module-runtime',
        exp: 1_700_000_601,
        iat: 1_700_000_000,
        installationId: '00000000-0000-4000-8000-000000000002',
        nonce: 'nonce-1234567890',
        permissions: [],
        userId: 'user-1',
        versionId: '00000000-0000-4000-8000-000000000003',
      }),
    ).toThrow();
  });
});
