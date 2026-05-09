import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chargeAfterGenerate } from './chargeAfterGenerate';

const mocks = vi.hoisted(() => ({
  postCharge: vi.fn(),
  shouldChargeCommercialUsage: vi.fn(),
}));

vi.mock('@/business/server/commercialBilling', () => ({
  shouldChargeCommercialUsage: mocks.shouldChargeCommercialUsage,
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn().mockImplementation(() => ({
    postCharge: mocks.postCharge,
  })),
}));

describe('video chargeAfterGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldChargeCommercialUsage.mockResolvedValue(true);
    mocks.postCharge.mockResolvedValue({ id: 'ledger-1' });
  });

  it('charges the prechecked display credit amount on successful generation', async () => {
    await chargeAfterGenerate({
      db: {} as any,
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'veo3.1-fast',
      },
      model: 'veo3.1-fast',
      prechargeResult: { estimatedCredits: CREDITS_PER_DOLLAR },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.postCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: CREDITS_PER_DOLLAR,
        referenceId: 'batch-1',
        referenceType: 'video_generation',
      }),
    );
  });

  it('falls back to one display credit when legacy precharge metadata has no amount', async () => {
    await chargeAfterGenerate({
      db: {} as any,
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'veo3.1-fast',
      },
      model: 'veo3.1-fast',
      prechargeResult: { costDetail: {} },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.postCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: CREDITS_PER_DOLLAR,
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
        modelId: 'veo3.1-fast',
      },
      model: 'veo3.1-fast',
      prechargeResult: { estimatedCredits: CREDITS_PER_DOLLAR },
      provider: 'newapi',
      userId: 'user-1',
    });

    expect(mocks.postCharge).not.toHaveBeenCalled();
  });
});
