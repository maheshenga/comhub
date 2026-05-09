import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chargeBeforeGenerate } from './chargeBeforeGenerate';

const mocks = vi.hoisted(() => ({
  preCharge: vi.fn(),
  shouldChargeCommercialUsage: vi.fn(),
}));

vi.mock('@/business/server/commercialBilling', () => ({
  shouldChargeCommercialUsage: mocks.shouldChargeCommercialUsage,
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    preCharge: mocks.preCharge,
  })),
}));

describe('image chargeBeforeGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.preCharge.mockResolvedValue({ creditAccountId: 'user-1' });
  });

  it('checks budget using display credits instead of raw single credits', async () => {
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

    expect(mocks.preCharge).toHaveBeenCalledWith(2 * CREDITS_PER_DOLLAR, {});
  });
});
