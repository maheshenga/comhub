import { ADMIN_COMMANDS } from '@lobechat/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_SETTINGS_SECTION_SWR_KEY, ADMIN_SETTINGS_SWR_KEY } from '@/const/adminCacheKeys';
import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';
import { DEFAULT_MOBILE_CONFIG, normalizeMobileConfig } from '@/const/mobileConfig';
import { mutate } from '@/libs/swr';
import { lambdaClient } from '@/libs/trpc/client';

import { adminCommercialService } from './adminCommercial';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    admin: {
      content: {
        deleteDocument: { mutate: vi.fn() },
      },
      settings: {
        getAll: { query: vi.fn() },
        getSection: { query: vi.fn() },
        setAppSetting: { mutate: vi.fn() },
        setAppSettingsBatch: { mutate: vi.fn() },
        validateDefaultAgentSettings: { mutate: vi.fn() },
      },
      moduleApps: {
        list: { query: vi.fn() },
      },
      newapiProviders: {
        getDeleteInstanceImpact: { query: vi.fn() },
        getModelCatalogDiagnostics: { query: vi.fn() },
        getRemoveModelImpact: { query: vi.fn() },
        syncInstanceModels: { mutate: vi.fn() },
        testInstanceConnection: { query: vi.fn() },
      },
      plans: {
        getDeleteImpact: { query: vi.fn() },
      },
      users: {
        compactDetail: { query: vi.fn() },
        recordImpersonationAttempt: { mutate: vi.fn() },
        recordImpersonationStart: { mutate: vi.fn() },
      },
    },
  },
}));

vi.mock('@/libs/swr', () => ({ mutate: vi.fn() }));

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

  it('loads structured deletion impact previews for plans, providers, and models', async () => {
    const impact = {
      blocking: [],
      canProceed: true,
      immediateEffects: [],
      liveEffects: [],
      target: { id: 'target', type: 'plan' },
      targetExists: true,
    } as any;
    vi.mocked(lambdaClient.admin.plans.getDeleteImpact.query).mockResolvedValue(impact);
    vi.mocked(lambdaClient.admin.newapiProviders.getDeleteInstanceImpact.query).mockResolvedValue(
      impact,
    );
    vi.mocked(lambdaClient.admin.newapiProviders.getRemoveModelImpact.query).mockResolvedValue(
      impact,
    );

    await adminCommercialService.getPlanDeleteImpact('premium');
    await adminCommercialService.getAiProviderInstanceDeleteImpact('instance-1');
    await adminCommercialService.getAiProviderModelDeleteImpact({
      instanceId: 'instance-1',
      modelId: 'gpt-4o',
      modelType: 'chat',
    });

    expect(lambdaClient.admin.plans.getDeleteImpact.query).toHaveBeenCalledWith({
      plan: 'premium',
    });
    expect(lambdaClient.admin.newapiProviders.getDeleteInstanceImpact.query).toHaveBeenCalledWith({
      id: 'instance-1',
    });
    expect(lambdaClient.admin.newapiProviders.getRemoveModelImpact.query).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      modelId: 'gpt-4o',
      modelType: 'chat',
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

  it('uses the compact user detail endpoint for cross-domain drawers', async () => {
    vi.mocked(lambdaClient.admin.users.compactDetail.query).mockResolvedValue({
      banned: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      id: 'target-user',
      lastActiveAt: null,
      role: 'user',
    });

    await adminCommercialService.getCompactUserDetail('target-user');

    expect(lambdaClient.admin.users.compactDetail.query).toHaveBeenCalledWith({
      userId: 'target-user',
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
    await expect(
      adminCommercialService.moduleApps.getPackage({ packageId: 'package-1' }),
    ).resolves.toEqual({
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
    await expect(
      adminCommercialService.moduleApps.listProducts({ appId: 'app1' }),
    ).resolves.toEqual([{ productId: 'product-1' }]);
    await expect(
      adminCommercialService.moduleApps.updateProduct(updateInput),
    ).resolves.toMatchObject({
      product: { id: 'product-1' },
    });
  });

  it('calls the AI provider model sync endpoint', async () => {
    vi.mocked(lambdaClient.admin.newapiProviders.syncInstanceModels.mutate).mockResolvedValue({
      importedCount: 1,
      modelsCount: 1,
      ok: true,
      pricingCount: 0,
      staleCount: 0,
      warnings: [],
    });

    await adminCommercialService.syncAiProviderInstanceModels('instance-1');

    expect(lambdaClient.admin.newapiProviders.syncInstanceModels.mutate).toHaveBeenCalledWith({
      id: 'instance-1',
    });
  });

  it('calls the AI provider model catalog diagnostics endpoint', async () => {
    vi.mocked(
      lambdaClient.admin.newapiProviders.getModelCatalogDiagnostics.query,
    ).mockResolvedValue({
      catalog: [],
      health: { hiddenByPlanCount: 0, modelTypeCount: 0, totalCount: 0, visibleCount: 0 },
      hiddenByReason: {},
      risks: [],
    });

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

  it('uses the requested file-storage section for upload URL settings reads', async () => {
    vi.mocked(lambdaClient.admin.settings.getSection.query).mockResolvedValue({
      section: 'file-storage',
      sharedHealth: {},
      storageS3PublicDomain: 'https://assets.example.com',
    } as any);

    await expect(adminCommercialService.getSettingsSection('file-storage')).resolves.toMatchObject({
      storageS3PublicDomain: 'https://assets.example.com',
    });

    expect(lambdaClient.admin.settings.getSection.query).toHaveBeenCalledWith({
      section: 'file-storage',
    });
    expect(lambdaClient.admin.settings.getAll.query).not.toHaveBeenCalled();
  });

  it('returns the bare normalized mobile configuration from the mobile section', async () => {
    vi.mocked(lambdaClient.admin.settings.getSection.query).mockResolvedValue({
      mobileConfig: DEFAULT_MOBILE_CONFIG,
      section: 'mobile',
      sharedHealth: {},
    } as any);

    await expect(adminCommercialService.getMobileSettings()).resolves.toEqual(
      DEFAULT_MOBILE_CONFIG,
    );
    expect(lambdaClient.admin.settings.getSection.query).toHaveBeenCalledWith({
      section: 'mobile',
    });
  });

  it('normalizes and persists the mobile configuration in one batch update', async () => {
    const rawConfig = {
      discover: {
        assistants: Array.from({ length: 5 }, (_, index) => ({
          assistantId: `assistant-${index}`,
          model: 'chat-model',
          order: index + 1,
          provider: 'catalog',
        })),
      },
      navigation: {
        items: [
          {
            icon: 'bell',
            id: 'slot-1',
            label: 'Inbox',
            order: 1,
            path: 'javascript:alert(1)',
            visible: true,
          },
        ],
      },
      version: 1,
    };
    const normalized = normalizeMobileConfig(rawConfig);
    vi.mocked(lambdaClient.admin.settings.setAppSettingsBatch.mutate).mockResolvedValue({
      count: 1,
      ok: true,
    });

    await expect(adminCommercialService.saveMobileSettings(rawConfig)).resolves.toEqual(normalized);

    expect(lambdaClient.admin.settings.setAppSettingsBatch.mutate).toHaveBeenCalledTimes(1);
    expect(lambdaClient.admin.settings.setAppSettingsBatch.mutate).toHaveBeenCalledWith({
      updates: [{ key: APP_SETTING_KEYS.mobileConfig, value: normalized }],
    });
  });

  it('invalidates only affected section caches and the compatibility aggregate after writes', async () => {
    vi.mocked(lambdaClient.admin.settings.setAppSettingsBatch.mutate).mockResolvedValue({
      count: 3,
      ok: true,
    });

    await adminCommercialService.setAppSettingsBatch({
      updates: [
        { key: 'auth.signup.enabled', value: false },
        { key: 'notification.retentionDays', value: 30 },
        { key: 'auth.signup.disabledMessage', value: 'Closed' },
      ],
    });

    expect(vi.mocked(mutate).mock.calls.map(([key]) => key)).toEqual([
      ADMIN_SETTINGS_SECTION_SWR_KEY('growth'),
      ADMIN_SETTINGS_SECTION_SWR_KEY('notifications'),
      ADMIN_SETTINGS_SWR_KEY,
    ]);
    expect(mutate).not.toHaveBeenCalledWith(ADMIN_SETTINGS_SECTION_SWR_KEY('operations'));
  });

  it('forwards the shared command to the catalogued Better Auth effect boundary', async () => {
    vi.mocked(lambdaClient.admin.users.recordImpersonationAttempt.mutate).mockResolvedValue({
      ok: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ok: true }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    const command = { actionId: 'user.impersonate.attempt', confirmed: true } as const;
    await adminCommercialService.impersonateUser('target-user', command);

    expect(ADMIN_COMMANDS['user.impersonate.attempt'].serverBoundary).toEqual({
      kind: 'http',
      method: 'POST',
      path: '/api/auth/admin/impersonate-user',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/admin/impersonate-user', {
      body: JSON.stringify({ command, userId: 'target-user' }),
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(lambdaClient.admin.users.recordImpersonationAttempt.mutate).not.toHaveBeenCalled();
    expect(getLegacyImpersonationStartMock()).not.toHaveBeenCalled();
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

    const command = { actionId: 'user.impersonate.attempt', confirmed: true } as const;
    await expect(adminCommercialService.impersonateUser('target-user', command)).rejects.toThrow(
      'forbidden',
    );

    expect(lambdaClient.admin.users.recordImpersonationAttempt.mutate).not.toHaveBeenCalled();
    expect(getLegacyImpersonationStartMock()).not.toHaveBeenCalled();
  });

  it('forwards the shared command envelope to a dangerous content mutation', async () => {
    vi.mocked(lambdaClient.admin.content.deleteDocument.mutate).mockResolvedValue({ ok: true });
    const command = { actionId: 'content.deleteDocument', confirmed: true } as const;

    await adminCommercialService.deleteAdminDocument('document-1', command);

    expect(lambdaClient.admin.content.deleteDocument.mutate).toHaveBeenCalledWith({
      command,
      documentId: 'document-1',
    });
  });
});
