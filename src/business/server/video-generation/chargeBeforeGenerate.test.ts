import type * as ModelRuntimeModule from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CommercialModelModule from '@/database/models/commercial';

import { chargeBeforeGenerate } from './chargeBeforeGenerate';

const mocks = vi.hoisted(() => ({
  preCharge: vi.fn(),
  shouldChargeCommercialUsage: vi.fn(),
  getModelPricing: vi.fn(),
  getAppSettingValue: vi.fn(),
}));

vi.mock('@lobechat/model-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof ModelRuntimeModule>();
  return {
    ...actual,
    getModelPricing: mocks.getModelPricing,
  };
});

vi.mock('@/business/server/commercialBilling', () => ({
  shouldChargeCommercialUsage: mocks.shouldChargeCommercialUsage,
}));

vi.mock('@/server/services/appSettings', () => ({
  APP_SETTING_KEYS: {
    pricingCreditMultiplier: 'pricing.creditMultiplier',
    pricingModelRules: 'pricing.modelRules',
  },
  getAppSettingValue: mocks.getAppSettingValue,
}));

vi.mock('@/database/models/commercial', async (importOriginal) => {
  const actual = await importOriginal<typeof CommercialModelModule>();
  return {
    ...actual,
    CommercialModel: vi.fn().mockImplementation(() => ({
      preCharge: mocks.preCharge,
    })),
  };
});

describe('video chargeBeforeGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.preCharge.mockResolvedValue({ creditAccountId: 'user-1' });
    mocks.getAppSettingValue.mockImplementation(async (key: string) =>
      key === 'pricing.creditMultiplier'
        ? 1.65
        : [{ model: 'veo3.1-fast', multiplier: 1.4, provider: 'newapi' }],
    );
    mocks.getModelPricing.mockResolvedValue({
      approximatePricePerVideo: 0.25,
      units: [],
    });
  });

  it('checks budget using the model video price with the configured multiplier', async () => {
    const result = await chargeBeforeGenerate({
      db: {} as any,
      generationTopicId: 'topic-1',
      model: 'veo3.1-fast',
      params: { prompt: 'make a video' },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.getModelPricing).toHaveBeenCalledWith('veo3.1-fast', 'newapi');
    expect(mocks.preCharge).toHaveBeenCalledWith(577_500, {});
    expect(result.prechargeResult?.estimatedCredits).toBe(577_500);
    expect(result.prechargeResult?.costDetail?.totalCost).toBe(0.25);
  });

  it('checks video budget with NewAPI route metadata pricing', async () => {
    mocks.getAppSettingValue.mockImplementation(async (key: string) =>
      key === 'pricing.creditMultiplier'
        ? 1
        : [{ group: 'pro', model: 'veo3.1-fast', multiplier: 2, provider: 'newapi' }],
    );

    const result = await chargeBeforeGenerate({
      db: {} as any,
      generationTopicId: 'topic-1',
      model: 'veo3.1-fast',
      params: { prompt: 'make a video' },
      provider: 'newapi',
      routeMetadata: {
        groupKey: 'pro',
        groupMultiplier: 1.5,
      },
      userId: 'user-1',
    });

    expect(mocks.preCharge).toHaveBeenCalledWith(750_000, {});
    expect(result.prechargeResult?.estimatedCredits).toBe(750_000);
  });
});
