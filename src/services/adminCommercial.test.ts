import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';

import { adminCommercialService } from './adminCommercial';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    admin: {
      settings: {
        validateDefaultAgentSettings: { mutate: vi.fn() },
      },
      newapiProviders: {
        syncInstanceModels: { mutate: vi.fn() },
        testInstanceConnection: { query: vi.fn() },
      },
    },
  },
}));

describe('adminCommercialService NewAPI helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the NewAPI connection test endpoint', async () => {
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

  it('calls the NewAPI model sync endpoint', async () => {
    vi.mocked(lambdaClient.admin.newapiProviders.syncInstanceModels.mutate).mockResolvedValue({
      importedCount: 1,
      modelsCount: 1,
      ok: true,
      pricingCount: 0,
      warnings: [],
    });

    await adminCommercialService.syncNewapiInstanceModels('instance-1');

    expect(lambdaClient.admin.newapiProviders.syncInstanceModels.mutate).toHaveBeenCalledWith({
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
});
