// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerModelPricing } from './serverModelPricing';

const mocks = vi.hoisted(() => ({
  getAiProviderModelList: vi.fn(),
  getModelPricing: vi.fn(),
  getServerGlobalConfig: vi.fn(),
}));

vi.mock('@lobechat/model-runtime', () => ({
  getModelPricing: mocks.getModelPricing,
}));

vi.mock('@/database/repositories/aiInfra', () => ({
  AiInfraRepos: vi.fn().mockImplementation(() => ({
    getAiProviderModelList: mocks.getAiProviderModelList,
  })),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: mocks.getServerGlobalConfig,
}));

describe('getServerModelPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerGlobalConfig.mockResolvedValue({ aiProvider: { newapi: { enabled: true } } });
    mocks.getModelPricing.mockResolvedValue(undefined);
  });

  it('prefers request database pricing for admin-managed generation models', async () => {
    const dbPricing = {
      approximatePricePerImage: 0.02,
      units: [],
    };
    const db = { id: 'request-db' } as any;
    mocks.getAiProviderModelList.mockResolvedValue([
      {
        id: 'gpt-image-2',
        pricing: dbPricing,
        type: 'image',
      },
    ]);

    const pricing = await getServerModelPricing({
      db,
      model: 'gpt-image-2',
      provider: 'newapi',
      type: 'image',
      userId: 'user-1',
    });

    expect(pricing).toBe(dbPricing);
    expect(mocks.getServerGlobalConfig).toHaveBeenCalledWith(db);
    expect(mocks.getAiProviderModelList).toHaveBeenCalledWith('newapi', { type: 'image' });
    expect(mocks.getModelPricing).not.toHaveBeenCalled();
  });

  it('falls back to static model-bank pricing when database pricing is missing', async () => {
    const staticPricing = {
      units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
    };
    mocks.getAiProviderModelList.mockResolvedValue([{ id: 'gpt-image-2', type: 'image' }]);
    mocks.getModelPricing.mockResolvedValue(staticPricing);

    const pricing = await getServerModelPricing({
      db: {} as any,
      model: 'gpt-image-2',
      provider: 'newapi',
      type: 'image',
      userId: 'user-1',
    });

    expect(pricing).toBe(staticPricing);
    expect(mocks.getModelPricing).toHaveBeenCalledWith('gpt-image-2', 'newapi');
  });
});
