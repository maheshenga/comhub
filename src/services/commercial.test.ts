import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';

import { commercialService } from './commercial';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    spend: {
      getAutoTopUpSetting: { query: vi.fn() },
      getResourceUsageSummary: { query: vi.fn() },
      updateAutoTopUpSetting: { mutate: vi.fn() },
    },
  },
}));

describe('commercialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the user auto top-up setting from spend endpoints', async () => {
    vi.mocked(lambdaClient.spend.getAutoTopUpSetting.query).mockResolvedValue({
      enabled: false,
      monthlyLimit: null,
      monthlyTopUpAmount: 0,
      targetBalance: 80_000_000,
      threshold: 40_000_000,
      updatedAt: null,
    });

    await commercialService.getAutoTopUpSetting();

    expect(lambdaClient.spend.getAutoTopUpSetting.query).toHaveBeenCalledWith();
  });

  it('updates the user auto top-up setting through spend endpoints', async () => {
    vi.mocked(lambdaClient.spend.updateAutoTopUpSetting.mutate).mockResolvedValue({
      enabled: true,
      monthlyLimit: 200_000_000,
      monthlyTopUpAmount: 0,
      targetBalance: 80_000_000,
      threshold: 40_000_000,
      updatedAt: null,
    });

    await commercialService.updateAutoTopUpSetting({
      enabled: true,
      monthlyLimit: 200_000_000,
      targetBalance: 80_000_000,
      threshold: 40_000_000,
    });

    expect(lambdaClient.spend.updateAutoTopUpSetting.mutate).toHaveBeenCalledWith({
      enabled: true,
      monthlyLimit: 200_000_000,
      targetBalance: 80_000_000,
      threshold: 40_000_000,
    });
  });

  it('reads resource usage summary from spend endpoints', async () => {
    vi.mocked(lambdaClient.spend.getResourceUsageSummary.query).mockResolvedValue({
      storage: { quota: 1_073_741_824, used: 536_870_912 },
      vector: { quota: 1200, used: 300 },
    });

    await commercialService.getResourceUsageSummary();

    expect(lambdaClient.spend.getResourceUsageSummary.query).toHaveBeenCalledWith();
  });
});
