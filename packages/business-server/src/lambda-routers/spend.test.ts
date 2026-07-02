import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { CommercialModel } from '@/database/models/commercial';

import { spendRouter } from './spend';

vi.mock('@/envs/app', () => ({
  appEnv: {},
}));

vi.mock('@/libs/trusted-client', () => ({
  isTrustedClientEnabled: vi.fn(() => false),
}));

(vi.mock as any)(
  '@/server/services/market',
  () => ({
    MarketService: vi.fn(),
  }),
  { virtual: true },
);

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn(),
}));

describe('spendRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerDB).mockResolvedValue('db' as any);
  });

  it('reads auto top-up setting through CommercialModel', async () => {
    const getAutoTopUpSetting = vi.fn().mockResolvedValue({
      enabled: false,
      monthlyLimit: null,
      monthlyTopUpAmount: 0,
      targetBalance: 120_000_000,
      threshold: 40_000_000,
      updatedAt: null,
    });
    vi.mocked(CommercialModel).mockImplementation(() => ({ getAutoTopUpSetting }) as any);

    const result = await spendRouter.createCaller({ userId: 'user-1' } as any).getAutoTopUpSetting();

    expect(CommercialModel).toHaveBeenCalledWith('db', 'user-1');
    expect(getAutoTopUpSetting).toHaveBeenCalledWith();
    expect(result).toEqual({
      enabled: false,
      monthlyLimit: null,
      monthlyTopUpAmount: 0,
      targetBalance: 120_000_000,
      threshold: 40_000_000,
      updatedAt: null,
    });
  });

  it('updates auto top-up setting through CommercialModel', async () => {
    const updateAutoTopUpSetting = vi.fn().mockResolvedValue({
      enabled: true,
      monthlyLimit: 200_000_000,
      monthlyTopUpAmount: 0,
      targetBalance: 120_000_000,
      threshold: 40_000_000,
      updatedAt: null,
    });
    vi.mocked(CommercialModel).mockImplementation(() => ({ updateAutoTopUpSetting }) as any);

    const input = {
      enabled: true,
      monthlyLimit: 200_000_000,
      targetBalance: 120_000_000,
      threshold: 40_000_000,
    };
    const result = await spendRouter
      .createCaller({ userId: 'user-1' } as any)
      .updateAutoTopUpSetting(input);

    expect(CommercialModel).toHaveBeenCalledWith('db', 'user-1');
    expect(updateAutoTopUpSetting).toHaveBeenCalledWith(input);
    expect(result.enabled).toBe(true);
  });

  it('reads resource usage summary through CommercialModel', async () => {
    const getResourceUsageSummary = vi.fn().mockResolvedValue({
      storage: { quota: 1_073_741_824, used: 536_870_912 },
      vector: { quota: 1200, used: 300 },
    });
    vi.mocked(CommercialModel).mockImplementation(() => ({ getResourceUsageSummary }) as any);

    const result = await spendRouter
      .createCaller({ userId: 'user-1' } as any)
      .getResourceUsageSummary();

    expect(CommercialModel).toHaveBeenCalledWith('db', 'user-1');
    expect(getResourceUsageSummary).toHaveBeenCalledWith();
    expect(result).toEqual({
      storage: { quota: 1_073_741_824, used: 536_870_912 },
      vector: { quota: 1200, used: 300 },
    });
  });
});
