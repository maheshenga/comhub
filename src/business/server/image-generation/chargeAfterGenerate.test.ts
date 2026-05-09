import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chargeAfterGenerate } from './chargeAfterGenerate';

const mocks = vi.hoisted(() => ({
  consumeCreditsForAiUsage: vi.fn(),
  postCharge: vi.fn(),
  shouldChargeCommercialUsage: vi.fn(),
}));

vi.mock('@/business/server/commercialBilling', () => ({
  shouldChargeCommercialUsage: mocks.shouldChargeCommercialUsage,
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    consumeCreditsForAiUsage: mocks.consumeCreditsForAiUsage,
    postCharge: mocks.postCharge,
  })),
}));

describe('image chargeAfterGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.postCharge.mockResolvedValue({ id: 'ledger-1' });
    mocks.consumeCreditsForAiUsage.mockResolvedValue({ id: 'ledger-1' });
  });

  it('charges at least one display credit when exact image usage cost is unavailable', async () => {
    await chargeAfterGenerate({
      db: {} as any,
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
        credits: CREDITS_PER_DOLLAR,
        referenceId: 'batch-1',
        referenceType: 'image_generation',
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
