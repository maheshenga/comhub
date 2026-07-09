import { describe, expect, it, vi } from 'vitest';
import type { ModuleAppPackageSubmitInput } from '@lobechat/types';

import { createModuleAppService } from './moduleApp';

describe('createModuleAppService', () => {
  it('calls moduleApp listMarketplace query', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'app1' }]);
    const service = createModuleAppService({
      moduleApp: {
        listMarketplace: { query },
      },
    } as never);

    await expect(service.listMarketplace({ query: 'desk' })).resolves.toEqual([{ id: 'app1' }]);
    expect(query).toHaveBeenCalledWith({ query: 'desk' });
  });

  it('calls moduleApp submitPackage mutation', async () => {
    const mutate = vi.fn().mockResolvedValue({ id: 'package-1' });
    const service = createModuleAppService({
      moduleApp: {
        submitPackage: { mutate },
      },
    } as never);
    const input: ModuleAppPackageSubmitInput = {
      archive: {
        fileName: 'package-app.zip',
        mimeType: 'application/zip',
        sha256: 'a'.repeat(64),
        sizeBytes: 1024,
        storageKey: 'module-app-packages/package-app.zip',
      },
      fileManifest: [{ path: 'manifest.json', sha256: 'a'.repeat(64), sizeBytes: 512 }],
      manifest: {
        app: {
          actions: [],
          appType: 'standard_app',
          billing: {
            chargeMode: 'free',
            defaultMultiplier: 1,
            externalApiCostCredits: 0,
            failureFixedFeePolicy: 'do_not_charge',
            fixedServiceFeeCredits: 0,
          },
          category: 'business',
          description: 'A package app.',
          displayName: 'Package App',
          icon: 'Package',
          pages: [],
          slug: 'package-app',
          source: 'developer',
          status: 'draft',
          tags: [],
        },
        entitlements: [],
        manifestVersion: 1,
        packageVersion: '1.0.0',
        runtime: { kind: 'manifest_only', permissions: [] },
      },
    };

    await expect(service.submitPackage(input)).resolves.toEqual({ id: 'package-1' });
    expect(mutate).toHaveBeenCalledWith(input);
  });
});
