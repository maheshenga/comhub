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

describe('video chargeBeforeGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.preCharge.mockResolvedValue({ creditAccountId: 'user-1' });
  });

  it('checks budget using at least one display credit', async () => {
    const result = await chargeBeforeGenerate({
      db: {} as any,
      generationTopicId: 'topic-1',
      model: 'veo3.1-fast',
      params: { prompt: 'make a video' },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.preCharge).toHaveBeenCalledWith(CREDITS_PER_DOLLAR, {});
    expect(result.prechargeResult?.estimatedCredits).toBe(CREDITS_PER_DOLLAR);
  });
});
