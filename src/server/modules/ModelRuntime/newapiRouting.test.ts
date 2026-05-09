// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initModelRuntimeFromDB } from './index';

const mocks = vi.hoisted(() => ({
  getAiProviderById: vi.fn(),
  getBusinessModelRuntimeHooks: vi.fn(),
  initializeWithProvider: vi.fn(),
  resolveDefaultNewapiInstance: vi.fn(),
  resolveNewapiInstancesForModel: vi.fn(),
}));

vi.mock('@lobechat/model-runtime', () => ({
  ModelRuntime: {
    initializeWithProvider: mocks.initializeWithProvider,
  },
}));

vi.mock('@lobechat/model-runtime/vertexai', () => ({
  LobeVertexAI: {
    initFromVertexAI: vi.fn(),
  },
}));

vi.mock('@/business/server/model-runtime', () => ({
  getBusinessModelRuntimeHooks: mocks.getBusinessModelRuntimeHooks,
}));

vi.mock('@/database/models/aiProvider', () => ({
  AiProviderModel: vi.fn().mockImplementation(() => ({
    getAiProviderById: mocks.getAiProviderById,
  })),
}));

vi.mock('@/envs/llm', () => ({
  getLLMConfig: vi.fn(() => ({})),
}));

vi.mock('@/server/services/newapiInstance', () => ({
  resolveDefaultNewapiInstance: mocks.resolveDefaultNewapiInstance,
  resolveNewapiInstancesForModel: mocks.resolveNewapiInstancesForModel,
}));

vi.mock('../KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    getUserKeyVaults: vi.fn(),
  },
}));

vi.mock('./apiKeyManager', () => ({
  default: {
    pick: vi.fn((key) => key),
  },
}));

describe('initModelRuntimeFromDB newapi routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiProviderById.mockResolvedValue({ keyVaults: {} });
    mocks.getBusinessModelRuntimeHooks.mockReturnValue({ beforeChat: vi.fn() });
    mocks.initializeWithProvider.mockReturnValue({ chat: vi.fn() });
  });

  it('should resolve newapi route by user plan and pass primary route metadata into hooks', async () => {
    const db = { id: 'db' } as any;
    const primaryRoute = {
      apiKey: 'sk-pro',
      baseUrl: 'https://newapi.example.com/v1',
      groupKey: 'pro',
      groupMultiplier: 1.5,
      groupName: 'Pro Group',
      instanceId: 'instance-pro',
      instanceName: 'NewAPI Pro',
      priority: 10,
      source: 'instance' as const,
    };
    mocks.resolveNewapiInstancesForModel.mockResolvedValue([primaryRoute]);

    await initModelRuntimeFromDB(db, 'user-1', 'newapi', {
      model: 'gpt-test',
      modelType: 'chat',
    });

    expect(mocks.resolveNewapiInstancesForModel).toHaveBeenCalledWith(db, {
      modelId: 'gpt-test',
      modelType: 'chat',
      userId: 'user-1',
    });
    expect(mocks.getBusinessModelRuntimeHooks).toHaveBeenCalledWith('user-1', 'newapi', {
      groupKey: 'pro',
      groupMultiplier: 1.5,
      groupName: 'Pro Group',
      instanceId: 'instance-pro',
      instanceName: 'NewAPI Pro',
    });
    expect(mocks.initializeWithProvider).toHaveBeenCalledWith(
      'newapi',
      expect.objectContaining({
        apiKey: 'sk-pro',
        baseURL: 'https://newapi.example.com/v1',
        userId: 'user-1',
      }),
      expect.anything(),
    );
  });
});
