// @vitest-environment node
import type { Pricing } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveNewapiModelPricing } from './pricingResolution';

const mocks = vi.hoisted(() => ({
  getLobeHubOfficialModelPricing: vi.fn(),
  getModelPricing: vi.fn(),
}));

vi.mock('@lobechat/model-runtime', () => ({
  getModelPricing: mocks.getModelPricing,
}));

vi.mock('./lobeHubOfficialPricing', () => ({
  getLobeHubOfficialModelPricing: mocks.getLobeHubOfficialModelPricing,
}));

const databasePricing = {
  units: [{ name: 'textInput', rate: 1, strategy: 'fixed', unit: 'millionTokens' }],
} as Pricing;
const officialPricing = {
  units: [{ name: 'textInput', rate: 0.5, strategy: 'fixed', unit: 'millionTokens' }],
} as Pricing;
const modelBankPricing = {
  units: [{ name: 'textInput', rate: 0.75, strategy: 'fixed', unit: 'millionTokens' }],
} as Pricing;

describe('resolveNewapiModelPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLobeHubOfficialModelPricing.mockResolvedValue(undefined);
    mocks.getModelPricing.mockResolvedValue(undefined);
  });

  it('keeps database pricing as the highest-priority source', async () => {
    await expect(
      resolveNewapiModelPricing({
        databasePricing,
        lobeHubOfficialPricingEnabled: true,
        model: 'gpt-test',
        modelBankFallbackEnabled: true,
        modelBankProvider: 'openai',
      }),
    ).resolves.toEqual({ pricing: databasePricing, source: 'database' });
    expect(mocks.getLobeHubOfficialModelPricing).not.toHaveBeenCalled();
    expect(mocks.getModelPricing).not.toHaveBeenCalled();
  });

  it('prefers official LobeHub pricing before Model Bank', async () => {
    mocks.getLobeHubOfficialModelPricing.mockResolvedValue(officialPricing);
    mocks.getModelPricing.mockResolvedValue(modelBankPricing);

    await expect(
      resolveNewapiModelPricing({
        lobeHubOfficialPricingEnabled: true,
        model: 'gpt-test',
        modelBankFallbackEnabled: true,
        modelBankProvider: 'openai',
      }),
    ).resolves.toEqual({ pricing: officialPricing, source: 'lobehub-official' });
    expect(mocks.getModelPricing).not.toHaveBeenCalled();
  });

  it('uses Model Bank when official pricing has no match', async () => {
    mocks.getModelPricing.mockResolvedValue(modelBankPricing);

    await expect(
      resolveNewapiModelPricing({
        lobeHubOfficialPricingEnabled: true,
        model: 'gpt-test',
        modelBankFallbackEnabled: true,
        modelBankProvider: 'openai',
      }),
    ).resolves.toEqual({ pricing: modelBankPricing, source: 'model-bank' });
    expect(mocks.getModelPricing).toHaveBeenCalledWith('gpt-test', 'openai');
  });

  it('returns missing instead of failing when fallback lookups throw', async () => {
    mocks.getLobeHubOfficialModelPricing.mockRejectedValue(new Error('catalog unavailable'));
    mocks.getModelPricing.mockRejectedValue(new Error('model bank unavailable'));

    await expect(
      resolveNewapiModelPricing({
        lobeHubOfficialPricingEnabled: true,
        model: 'gpt-test',
        modelBankFallbackEnabled: true,
      }),
    ).resolves.toEqual({ source: 'missing' });
  });
});
