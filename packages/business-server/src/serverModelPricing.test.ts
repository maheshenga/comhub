// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerModelPricing, getServerModelPricingSnapshot } from './serverModelPricing';

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

  it('returns a database pricing snapshot when admin-managed pricing is available', async () => {
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

    const snapshot = await getServerModelPricingSnapshot({
      db,
      model: 'gpt-image-2',
      provider: 'newapi',
      type: 'image',
      userId: 'user-1',
    });

    expect(snapshot).toMatchObject({
      pricing: dbPricing,
      source: 'database',
    });
    expect(snapshot.modelCard?.id).toBe('gpt-image-2');
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

  it('returns a model-bank pricing snapshot when database pricing is unavailable', async () => {
    const staticPricing = {
      units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
    };
    mocks.getAiProviderModelList.mockResolvedValue([{ id: 'gpt-image-2', type: 'image' }]);
    mocks.getModelPricing.mockResolvedValue(staticPricing);

    const snapshot = await getServerModelPricingSnapshot({
      db: {} as any,
      model: 'gpt-image-2',
      provider: 'newapi',
      type: 'image',
      userId: 'user-1',
    });

    expect(snapshot).toMatchObject({
      pricing: staticPricing,
      source: 'model-bank',
    });
    expect(snapshot.modelCard?.id).toBe('gpt-image-2');
  });

  it('returns a missing pricing snapshot when no pricing source is available', async () => {
    mocks.getAiProviderModelList.mockResolvedValue([{ id: 'gpt-image-2', type: 'image' }]);
    mocks.getModelPricing.mockResolvedValue(undefined);

    await expect(
      getServerModelPricingSnapshot({
        db: {} as any,
        model: 'gpt-image-2',
        provider: 'newapi',
        type: 'image',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      pricing: undefined,
      source: 'missing',
    });
  });
});
