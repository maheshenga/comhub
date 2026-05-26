import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PlanModelRulesModule from '@/business/server/planModelRules';
import { resolvePlanModelRules } from '@/business/server/planModelRules';

import {
  getAllEnabledModels,
  resolveDefaultNewapiInstance,
  resolveNewapiInstancesForModel,
} from './index';

vi.mock('@/business/server/planModelRules', async () => {
  const actual = await vi.importActual<typeof PlanModelRulesModule>(
    '@/business/server/planModelRules',
  );

  return {
    ...actual,
    resolvePlanModelRules: vi.fn(),
  };
});

const createDb = (rows: any[]) => {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    orderBy: vi.fn().mockResolvedValue(rows),
    where: vi.fn(() => chain),
  };

  return {
    select: vi.fn(() => chain),
  } as any;
};

describe('NewAPI instance resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolvePlanModelRules).mockResolvedValue(null);
  });

  it('allows free plan basic group and denies pro group for the same model', async () => {
    vi.mocked(resolvePlanModelRules).mockResolvedValue({
      chat: { allowlist: ['basic:gpt-4o-mini'], mode: 'allowlist' },
    });
    const db = createDb([
      {
        apiKey: 'sk-basic',
        baseUrl: 'https://basic.example.com',
        groupKey: 'basic',
        groupName: 'Basic',
        groupMultiplier: 1,
        id: 'basic-1',
        name: 'Basic 1',
        priority: 0,
        usageScope: ['chat'],
      },
      {
        apiKey: 'sk-pro',
        baseUrl: 'https://pro.example.com',
        groupKey: 'pro',
        groupName: 'Pro',
        groupMultiplier: 2,
        id: 'pro-1',
        name: 'Pro 1',
        priority: 1,
        usageScope: ['chat'],
      },
    ]);

    const routes = await resolveNewapiInstancesForModel(db, {
      modelId: 'gpt-4o-mini',
      modelType: 'chat',
      userId: 'user-1',
    });

    expect(routes.map((route) => route.groupKey)).toEqual(['basic']);
  });

  it('allows premium plan pro group models', async () => {
    vi.mocked(resolvePlanModelRules).mockResolvedValue({
      chat: { allowlist: ['pro:gpt-4o'], mode: 'allowlist' },
    });
    const db = createDb([
      {
        apiKey: 'sk-pro',
        baseUrl: 'https://pro.example.com',
        groupKey: 'pro',
        groupName: 'Pro',
        groupMultiplier: 2,
        id: 'pro-1',
        name: 'Pro 1',
        priority: 0,
        providerType: 'aliyun',
        usageScope: ['chat'],
      },
    ]);

    const routes = await resolveNewapiInstancesForModel(db, {
      modelId: 'gpt-4o',
      modelType: 'chat',
      userId: 'user-1',
    });

    expect(routes[0]).toEqual(
      expect.objectContaining({
        groupKey: 'pro',
        groupName: 'Pro',
        groupMultiplier: 2,
        providerType: 'aliyun',
      }),
    );
  });

  it('returns fallback candidates from the same group only', async () => {
    const db = createDb([
      {
        apiKey: 'sk-pro-1',
        baseUrl: 'https://a.example.com',
        groupKey: 'pro',
        id: 'pro-1',
        name: 'Pro 1',
        priority: 0,
      },
      {
        apiKey: 'sk-vip-1',
        baseUrl: 'https://b.example.com',
        groupKey: 'vip',
        id: 'vip-1',
        name: 'Vip 1',
        priority: 1,
      },
      {
        apiKey: 'sk-pro-2',
        baseUrl: 'https://c.example.com',
        groupKey: 'pro',
        id: 'pro-2',
        name: 'Pro 2',
        priority: 2,
      },
    ]);

    const routes = await resolveNewapiInstancesForModel(db, {
      modelId: 'gpt-4o',
      modelType: 'chat',
      preferredGroupKey: 'pro',
    });

    expect(routes.map((route) => route.instanceId)).toEqual(['pro-1', 'pro-2']);
  });

  it('respects instance usage scope', async () => {
    const db = createDb([
      {
        apiKey: 'sk-image',
        baseUrl: 'https://image.example.com',
        groupKey: 'basic',
        id: 'image-1',
        name: 'Image only',
        priority: 0,
        usageScope: ['image'],
      },
      {
        apiKey: 'sk-chat',
        baseUrl: 'https://chat.example.com',
        groupKey: 'basic',
        id: 'chat-1',
        name: 'Chat',
        priority: 1,
        usageScope: ['chat'],
      },
    ]);

    const routes = await resolveNewapiInstancesForModel(db, {
      modelId: 'gpt-4o',
      modelType: 'chat',
    });

    expect(routes.map((route) => route.instanceId)).toEqual(['chat-1']);
  });

  it('prefers default group for default instance resolution', async () => {
    const db = createDb([
      {
        apiKey: 'sk-pro',
        baseUrl: 'https://pro.example.com',
        groupKey: 'pro',
        id: 'pro-1',
        name: 'Pro',
        priority: 0,
      },
      {
        apiKey: 'sk-default',
        baseUrl: 'https://default.example.com',
        groupKey: 'default',
        id: 'default-1',
        name: 'Default',
        priority: 1,
      },
    ]);

    await expect(resolveDefaultNewapiInstance(db)).resolves.toEqual(
      expect.objectContaining({
        groupKey: 'default',
        instanceId: 'default-1',
      }),
    );
  });

  it('keeps enabled model routes distinct when the same model exists in multiple groups', async () => {
    const db = createDb([
      {
        displayName: 'GPT-4o',
        groupKey: 'basic',
        groupName: 'Basic',
        instanceId: 'basic-1',
        instanceName: 'Basic Gateway',
        modelId: 'gpt-4o',
        modelType: 'chat',
        providerType: 'newapi',
      },
      {
        displayName: 'GPT-4o',
        groupKey: 'pro',
        groupName: 'Pro',
        instanceId: 'pro-1',
        instanceName: 'Pro Gateway',
        modelId: 'gpt-4o',
        modelType: 'chat',
        providerType: 'openai-compatible',
      },
    ]);

    await expect(getAllEnabledModels(db)).resolves.toEqual([
      expect.objectContaining({
        groupKey: 'basic',
        id: 'gpt-4o',
        instanceName: 'Basic Gateway',
      }),
      expect.objectContaining({
        groupKey: 'pro',
        id: 'gpt-4o',
        instanceName: 'Pro Gateway',
      }),
    ]);
  });

  it('returns pricing converted from stored NewAPI metadata', async () => {
    const db = createDb([
      {
        displayName: 'GPT-4o Mini',
        groupKey: 'basic',
        groupName: 'Basic',
        instanceId: 'basic-1',
        instanceName: 'Basic Gateway',
        metadata: {
          completionRatio: 2,
          modelRatio: 0.15,
          pricingAvailable: true,
          quotaType: 0,
        },
        modelId: 'gpt-4o-mini',
        modelType: 'chat',
        providerType: 'newapi',
      },
      {
        displayName: 'GPT Image',
        groupKey: 'basic',
        groupName: 'Basic',
        instanceId: 'basic-1',
        instanceName: 'Basic Gateway',
        metadata: {
          modelPrice: 0.03,
          pricingAvailable: true,
          quotaType: 1,
        },
        modelId: 'gpt-image-2',
        modelType: 'image',
        providerType: 'newapi',
      },
    ]);

    await expect(getAllEnabledModels(db)).resolves.toEqual([
      expect.objectContaining({
        id: 'gpt-4o-mini',
        pricing: {
          units: [
            { name: 'textInput', rate: 0.3, strategy: 'fixed', unit: 'millionTokens' },
            { name: 'textOutput', rate: 0.6, strategy: 'fixed', unit: 'millionTokens' },
          ],
        },
      }),
      expect.objectContaining({
        id: 'gpt-image-2',
        pricing: {
          approximatePricePerImage: 0.03,
          units: [{ name: 'imageGeneration', rate: 0.03, strategy: 'fixed', unit: 'image' }],
        },
      }),
    ]);
  });
});
