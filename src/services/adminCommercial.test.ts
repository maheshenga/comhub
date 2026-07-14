import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';

import { adminCommercialService } from './adminCommercial';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    admin: {
      settings: {
        validateDefaultAgentSettings: { mutate: vi.fn() },
      },
      moduleApps: {
        list: { query: vi.fn() },
      },
      newapiProviders: {
        getModelCatalogDiagnostics: { query: vi.fn() },
        syncInstanceModels: { mutate: vi.fn() },
        testInstanceConnection: { query: vi.fn() },
      },
      users: {
        recordImpersonationAttempt: { mutate: vi.fn() },
        recordImpersonationStart: { mutate: vi.fn() },
      },
    },
  },
}));

describe('adminCommercialService NewAPI helpers', () => {
  const getLegacyImpersonationStartMock = () =>
    (lambdaClient.admin.users as any).recordImpersonationStart.mutate;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the AI provider connection test endpoint', async () => {
    vi.mocked(lambdaClient.admin.newapiProviders.testInstanceConnection.query).mockResolvedValue({
      modelsCount: 1,
      ok: true,
      pricingCount: 0,
      warnings: [],
    });

    await adminCommercialService.testAiProviderInstanceConnection('instance-1');

    expect(lambdaClient.admin.newapiProviders.testInstanceConnection.query).toHaveBeenCalledWith({
      id: 'instance-1',
    });
  });

  it('calls the module app admin list endpoint', async () => {
    vi.mocked(lambdaClient.admin.moduleApps.list.query).mockResolvedValue({
      items: [{ id: 'app1' } as any],
      nextCursor: null,
    });

    await expect(adminCommercialService.moduleApps.list({ status: 'published' })).resolves.toEqual({
      items: [{ id: 'app1' }],
      nextCursor: null,
    });

    expect(lambdaClient.admin.moduleApps.list.query).toHaveBeenCalledWith({
      status: 'published',
    });
  });

  it('calls the module app admin detail endpoint', async () => {
    (lambdaClient.admin.moduleApps as any).get = {
      query: vi.fn().mockResolvedValue({ id: 'app1' }),
    };

    await expect(adminCommercialService.moduleApps.get({ appId: 'app1' })).resolves.toEqual({
      id: 'app1',
    });

    expect((lambdaClient.admin.moduleApps as any).get.query).toHaveBeenCalledWith({
      appId: 'app1',
    });
  });

  it('calls the module app package review endpoints', async () => {
    (lambdaClient.admin.moduleApps as any).listPackages = {
      query: vi.fn().mockResolvedValue({ items: [{ id: 'package-1' }], nextCursor: null }),
    };
    (lambdaClient.admin.moduleApps as any).getPackage = {
      query: vi.fn().mockResolvedValue({ id: 'package-1' }),
    };
    (lambdaClient.admin.moduleApps as any).approvePackage = {
      mutate: vi.fn().mockResolvedValue({ appId: 'app-1', package: { id: 'package-1' } }),
    };
    (lambdaClient.admin.moduleApps as any).rejectPackage = {
      mutate: vi.fn().mockResolvedValue({ package: { id: 'package-1', reviewStatus: 'rejected' } }),
    };
    (lambdaClient.admin.moduleApps as any).rescanPackage = {
      mutate: vi.fn().mockResolvedValue({ packageId: 'package-1', scanStatus: 'clean' }),
    };

    await expect(
      adminCommercialService.moduleApps.listPackages({ reviewStatus: 'pending_review' }),
    ).resolves.toEqual({ items: [{ id: 'package-1' }], nextCursor: null });
    await expect(adminCommercialService.moduleApps.getPackage({ packageId: 'package-1' })).resolves.toEqual({
      id: 'package-1',
    });
    await expect(
      adminCommercialService.moduleApps.approvePackage({ packageId: 'package-1' }),
    ).resolves.toEqual({ appId: 'app-1', package: { id: 'package-1' } });
    await expect(
      adminCommercialService.moduleApps.rejectPackage({
        packageId: 'package-1',
        reason: 'Unsafe manifest',
      }),
    ).resolves.toEqual({ package: { id: 'package-1', reviewStatus: 'rejected' } });
    await expect(
      adminCommercialService.moduleApps.rescanPackage({ packageId: 'package-1' }),
    ).resolves.toEqual({ packageId: 'package-1', scanStatus: 'clean' });

    expect((lambdaClient.admin.moduleApps as any).listPackages.query).toHaveBeenCalledWith({
      reviewStatus: 'pending_review',
    });
    expect((lambdaClient.admin.moduleApps as any).getPackage.query).toHaveBeenCalledWith({
      packageId: 'package-1',
    });
    expect((lambdaClient.admin.moduleApps as any).approvePackage.mutate).toHaveBeenCalledWith({
      packageId: 'package-1',
    });
    expect((lambdaClient.admin.moduleApps as any).rejectPackage.mutate).toHaveBeenCalledWith({
      packageId: 'package-1',
      reason: 'Unsafe manifest',
    });
    expect((lambdaClient.admin.moduleApps as any).rescanPackage.mutate).toHaveBeenCalledWith({
      packageId: 'package-1',
    });
  });

  it('calls the module app admin publish endpoint', async () => {
    (lambdaClient.admin.moduleApps as any).publish = {
      mutate: vi.fn().mockResolvedValue({ ok: true }),
    };

    await expect(adminCommercialService.moduleApps.publish({ appId: 'app1' })).resolves.toEqual({
      ok: true,
    });

    expect((lambdaClient.admin.moduleApps as any).publish.mutate).toHaveBeenCalledWith({
      appId: 'app1',
    });
  });

  it('calls the module app admin upsert endpoint', async () => {
    (lambdaClient.admin.moduleApps as any).upsert = {
      mutate: vi.fn().mockResolvedValue({ id: 'app1', slug: 'workbench' }),
    };

    const input = {
      actions: [],
      appType: 'standard_app',
      billing: {},
      category: 'office',
      description: 'Simple workbench app.',
      displayName: 'Workbench',
      icon: 'Blocks',
      pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
      slug: 'workbench',
      status: 'draft',
      tags: [],
    };

    await expect(adminCommercialService.moduleApps.upsert(input)).resolves.toEqual({
      id: 'app1',
      slug: 'workbench',
    });

    expect((lambdaClient.admin.moduleApps as any).upsert.mutate).toHaveBeenCalledWith(input);
  });

  it('calls module app product management endpoints', async () => {
    (lambdaClient.admin.moduleApps as any).createProduct = {
      mutate: vi.fn().mockResolvedValue({ id: 'product-1' }),
    };
    (lambdaClient.admin.moduleApps as any).listProducts = {
      query: vi.fn().mockResolvedValue([{ productId: 'product-1' }]),
    };
    (lambdaClient.admin.moduleApps as any).updateProduct = {
      mutate: vi.fn().mockResolvedValue({ product: { id: 'product-1' } }),
    };
    const createInput = {
      appId: 'app1',
      licenseScope: 'personal' as const,
      price: { amount: 88, currency: 'CNY' },
      productKey: 'pro',
      productType: 'one_time' as const,
    };
    const updateInput = {
      licenseScope: 'personal' as const,
      price: { amount: 120, currency: 'CNY' },
      productId: 'product-1',
      productType: 'one_time' as const,
      status: 'active' as const,
    };

    await expect(adminCommercialService.moduleApps.createProduct(createInput)).resolves.toEqual({
      id: 'product-1',
    });
    await expect(adminCommercialService.moduleApps.listProducts({ appId: 'app1' })).resolves.toEqual([
      { productId: 'product-1' },
    ]);
    await expect(adminCommercialService.moduleApps.updateProduct(updateInput)).resolves.toMatchObject({
      product: { id: 'product-1' },
    });
  });

  it('calls the AI provider model sync endpoint', async () => {
    vi.mocked(lambdaClient.admin.newapiProviders.syncInstanceModels.mutate).mockResolvedValue({
      importedCount: 1,
      modelsCount: 1,
      ok: true,
      pricingCount: 0,
      warnings: [],
    });

    await adminCommercialService.syncAiProviderInstanceModels('instance-1');

    expect(lambdaClient.admin.newapiProviders.syncInstanceModels.mutate).toHaveBeenCalledWith({
      id: 'instance-1',
    });
  });

  it('calls the AI provider model catalog diagnostics endpoint', async () => {
    vi.mocked(lambdaClient.admin.newapiProviders.getModelCatalogDiagnostics.query).mockResolvedValue(
      {
        catalog: [],
        health: { hiddenByPlanCount: 0, modelTypeCount: 0, totalCount: 0, visibleCount: 0 },
        hiddenByReason: {},
        risks: [],
      },
    );

    await adminCommercialService.getAiProviderModelCatalogDiagnostics();

    expect(
      lambdaClient.admin.newapiProviders.getModelCatalogDiagnostics.query,
    ).toHaveBeenCalledWith();
  });

  it('keeps legacy NewAPI helper aliases for compatibility', async () => {
    vi.mocked(lambdaClient.admin.newapiProviders.testInstanceConnection.query).mockResolvedValue({
      modelsCount: 1,
      ok: true,
      pricingCount: 0,
      warnings: [],
    });

    await adminCommercialService.testNewapiInstanceConnection('instance-1');

    expect(lambdaClient.admin.newapiProviders.testInstanceConnection.query).toHaveBeenCalledWith({
      id: 'instance-1',
    });
  });

  it('calls the default agent settings validation endpoint', async () => {
    vi.mocked(lambdaClient.admin.settings.validateDefaultAgentSettings.mutate).mockResolvedValue({
      ok: true,
    });

    await adminCommercialService.validateDefaultAgentSettings({
      model: 'deepseek-chat',
      provider: 'newapi',
    });

    expect(lambdaClient.admin.settings.validateDefaultAgentSettings.mutate).toHaveBeenCalledWith({
      model: 'deepseek-chat',
      provider: 'newapi',
    });
  });

  it('records an impersonation attempt before calling the Better Auth endpoint', async () => {
    vi.mocked(lambdaClient.admin.users.recordImpersonationAttempt.mutate).mockResolvedValue({
      ok: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ok: true }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await adminCommercialService.impersonateUser('target-user');

    expect(lambdaClient.admin.users.recordImpersonationAttempt.mutate).toHaveBeenCalledWith({
      userId: 'target-user',
    });
    expect(getLegacyImpersonationStartMock()).not.toHaveBeenCalled();
    const attemptCallOrder = vi.mocked(lambdaClient.admin.users.recordImpersonationAttempt.mutate)
      .mock.invocationCallOrder[0];
    expect(attemptCallOrder).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
  });

  it('does not mark a failed Better Auth impersonation request as started', async () => {
    vi.mocked(lambdaClient.admin.users.recordImpersonationAttempt.mutate).mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue('forbidden'),
      }),
    );

    await expect(adminCommercialService.impersonateUser('target-user')).rejects.toThrow(
      'forbidden',
    );

    expect(lambdaClient.admin.users.recordImpersonationAttempt.mutate).toHaveBeenCalledWith({
      userId: 'target-user',
    });
    expect(getLegacyImpersonationStartMock()).not.toHaveBeenCalled();
  });
});
