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
  APP_SETTING_KEYS: { pricingCreditMultiplier: 'pricing.creditMultiplier' },
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

describe('image chargeBeforeGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.preCharge.mockResolvedValue({ creditAccountId: 'user-1' });
    mocks.getAppSettingValue.mockImplementation(async (key: string) =>
      key === 'pricing.creditMultiplier'
        ? 1.65
        : [{ model: 'gpt-image-2', multiplier: 1.2, provider: 'newapi' }],
    );
    mocks.getModelPricing.mockResolvedValue({
      approximatePricePerImage: 0.053,
      units: [],
    });
  });

  it('checks budget using the model image price with the configured multiplier', async () => {
    await chargeBeforeGenerate({
      configForDatabase: { prompt: 'draw a cat' },
      db: {} as any,
      generationParams: { prompt: 'draw a cat' },
      generationTopicId: 'topic-1',
      imageNum: 2,
      model: 'gpt-image-2',
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.getModelPricing).toHaveBeenCalledWith('gpt-image-2', 'newapi');
    expect(mocks.preCharge).toHaveBeenCalledWith(209_880, {});
  });
});
