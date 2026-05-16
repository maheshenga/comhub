import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
