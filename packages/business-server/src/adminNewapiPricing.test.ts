// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdminNewapiModelCard } from './adminNewapiPricing';

const mocks = vi.hoisted(() => ({
  resolveNewapiModelPricingFromMetadata: vi.fn(),
}));

vi.mock('@/server/services/newapiInstance', () => ({
  resolveNewapiModelPricingFromMetadata: mocks.resolveNewapiModelPricingFromMetadata,
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (...values: unknown[]) => values,
}));

vi.mock('@/database/schemas', () => ({
  adminNewapiInstanceModels: {
    displayName: 'displayName',
    enabled: 'modelEnabled',
    instanceId: 'instanceId',
    metadata: 'metadata',
    modelId: 'modelId',
    modelType: 'modelType',
  },
  adminNewapiInstances: {
    enabled: 'instanceEnabled',
    id: 'id',
  },
}));

const createDb = (rows: any[]) => {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn().mockResolvedValue(rows),
  };

  return { select: vi.fn(() => chain) } as any;
};

describe('getAdminNewapiModelCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads pricing metadata for the exact selected instance', async () => {
    const metadata = {
      modelRatio: 37.5,
      pricingSyncStatus: 'available',
      quotaType: 0,
    };
    const pricing = {
      units: [
        {
          name: 'textInput',
          rate: 75,
          strategy: 'fixed',
          unit: 'millionTokens',
        },
      ],
    };
    const db = createDb([
      {
        displayName: 'GPT 5.6 SOL',
        metadata,
        modelId: 'gpt-5.6-sol',
        modelType: 'chat',
      },
    ]);
    mocks.resolveNewapiModelPricingFromMetadata.mockReturnValue(pricing);

    await expect(
      getAdminNewapiModelCard({
        db,
        model: 'gpt-5.6-sol',
        provider: 'a61d4caa-adcb-45cd-a9b6-0d3fd9d5535a',
        type: 'chat',
      }),
    ).resolves.toEqual({
      displayName: 'GPT 5.6 SOL',
      enabled: true,
      id: 'gpt-5.6-sol',
      pricing,
      source: 'custom',
      type: 'chat',
    });
    expect(mocks.resolveNewapiModelPricingFromMetadata).toHaveBeenCalledWith(metadata, 'chat');
  });

  it('uses the route metadata instance when the runtime provider is generic', async () => {
    const db = createDb([
      {
        displayName: null,
        metadata: { manualPricing: { inputRate: 1 } },
        modelId: 'custom-chat',
        modelType: 'chat',
      },
    ]);
    mocks.resolveNewapiModelPricingFromMetadata.mockReturnValue({ units: [] });

    await expect(
      getAdminNewapiModelCard({
        db,
        model: 'custom-chat',
        provider: 'newapi',
        routeMetadata: { instanceId: 'bd31d12b-3edc-480c-8fbe-e05a305f5384' },
        type: 'chat',
      }),
    ).resolves.toMatchObject({ id: 'custom-chat', type: 'chat' });
  });

  it('does not query admin rows for a non-instance provider id', async () => {
    const db = createDb([]);

    await expect(
      getAdminNewapiModelCard({
        db,
        model: 'gpt-5.6-sol',
        provider: 'newapi',
        type: 'chat',
      }),
    ).resolves.toBeUndefined();
    expect(db.select).not.toHaveBeenCalled();
  });
});
