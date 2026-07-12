import { describe, expect, it } from 'vitest';

import {
  moduleAppBuildProfileSchema,
  moduleAppCapabilityClaimsSchema,
  moduleAppExecutableRuntimeSchema,
  moduleAppLaunchContextSchema,
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

  it('includes the trusted display name in a launch context', () => {
    expect(
      moduleAppLaunchContextSchema.parse({
        capability: 'signed-capability',
        displayName: 'Jobs Board',
        expiresAt: '2026-07-11T08:05:00.000Z',
        iframeUrl: 'https://module-runtime.example.com/artifacts/hash/dist/index.html',
        installationId: '00000000-0000-4000-8000-000000000001',
        nonce: 'launch-nonce-0001',
        runtimeOrigin: 'https://module-runtime.example.com',
      }),
    ).toMatchObject({ displayName: 'Jobs Board' });
  });

  it('accepts bounded data table and workflow declarations for executable apps', () => {
    expect(
      moduleAppExecutableRuntimeSchema.parse({
        data: {
          tables: [
            {
              fields: [{ key: 'email', required: true, type: 'string' }],
              indexes: [{ fields: ['email'], unique: true }],
              key: 'candidates',
            },
          ],
        },
        workflows: [
          {
            edges: [],
            key: 'capture_candidate',
            nodes: [{ config: {}, key: 'capture', type: 'function' }],
            startNodeKey: 'capture',
            version: 1,
          },
        ],
      }),
    ).toMatchObject({
      data: { tables: [expect.objectContaining({ key: 'candidates' })] },
      workflows: [expect.objectContaining({ key: 'capture_candidate' })],
    });
  });
});
