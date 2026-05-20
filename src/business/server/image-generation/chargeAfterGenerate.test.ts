import type * as ModelRuntimeModule from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CommercialModelModule from '@/database/models/commercial';

import { chargeAfterGenerate } from './chargeAfterGenerate';

const mocks = vi.hoisted(() => ({
  consumeCreditsForAiUsage: vi.fn(),
  getModelPricing: vi.fn(),
  postCharge: vi.fn(),
  shouldChargeCommercialUsage: vi.fn(),
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
      consumeCreditsForAiUsage: mocks.consumeCreditsForAiUsage,
      postCharge: mocks.postCharge,
    })),
  };
});

describe('image chargeAfterGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.postCharge.mockResolvedValue({ id: 'ledger-1' });
    mocks.consumeCreditsForAiUsage.mockResolvedValue({ id: 'ledger-1' });
    mocks.getAppSettingValue.mockImplementation(async (key: string) =>
      key === 'pricing.creditMultiplier' ? 1.65 : [],
    );
    mocks.getModelPricing.mockResolvedValue({
      approximatePricePerImage: 0.053,
      units: [],
    });
  });

  it('charges the actual image usage cost with the configured multiplier', async () => {
    await chargeAfterGenerate({
      db: {} as any,
      modelUsage: { cost: 0.034 },
      metrics: { latency: 1234 },
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'gpt-image-2',
      },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.postCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: 56_100,
        referenceId: 'task-1',
        referenceType: 'image_generation',
      }),
    );
  });

  it('applies NewAPI route metadata to image pricing multiplier', async () => {
    mocks.getAppSettingValue.mockImplementation(async (key: string) =>
      key === 'pricing.creditMultiplier'
        ? 1
        : [
            { group: 'pro', model: 'gpt-image-2', multiplier: 2, provider: 'newapi' },
            { model: 'gpt-image-2', multiplier: 1.2, provider: 'newapi' },
          ],
    );

    await chargeAfterGenerate({
      db: {} as any,
      modelUsage: { cost: 0.034 },
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'gpt-image-2',
        routeMetadata: {
          groupKey: 'pro',
          groupMultiplier: 1.5,
          providerType: 'newapi',
        },
      },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.postCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: 102_000,
      }),
    );
  });

  it('does not deduct credits on failed generation because preCharge only checks budget', async () => {
    await chargeAfterGenerate({
      db: {} as any,
      isError: true,
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'gpt-image-2',
      },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.postCharge).not.toHaveBeenCalled();
    expect(mocks.consumeCreditsForAiUsage).not.toHaveBeenCalled();
  });
});
