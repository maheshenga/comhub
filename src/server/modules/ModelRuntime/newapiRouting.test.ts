// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initModelRuntimeFromDB } from './index';

const mocks = vi.hoisted(() => ({
  buildNewapiRouteMetadata: vi.fn((instance?: any) =>
    instance
      ? {
          ...(instance.groupKey ? { groupKey: instance.groupKey } : {}),
          ...(instance.groupMultiplier === null || instance.groupMultiplier === undefined
            ? {}
            : { groupMultiplier: instance.groupMultiplier }),
          ...(instance.groupName ? { groupName: instance.groupName } : {}),
          ...(instance.instanceId ? { instanceId: instance.instanceId } : {}),
          ...(instance.instanceName ? { instanceName: instance.instanceName } : {}),
          ...(instance.providerType ? { providerType: instance.providerType } : {}),
        }
      : undefined,
  ),
  getAiProviderById: vi.fn(),
  getBusinessModelRuntimeHooks: vi.fn(),
  createLLMGenerationTracingHook: vi.fn(),
  initializeWithProvider: vi.fn(),
  mergeModelRuntimeHooks: vi.fn((...hooks: any[]) => Object.assign({}, ...hooks.filter(Boolean))),
  resolveDefaultNewapiInstance: vi.fn(),
  resolveNewapiInstancesForModel: vi.fn(),
}));

vi.mock('@lobechat/model-runtime', () => ({
  mergeModelRuntimeHooks: mocks.mergeModelRuntimeHooks,
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

vi.mock('@/server/services/llmGenerationTracing/hook', () => ({
  createLLMGenerationTracingHook: mocks.createLLMGenerationTracingHook,
}));

vi.mock('@/server/services/newapiInstance', () => ({
  buildNewapiRouteMetadata: mocks.buildNewapiRouteMetadata,
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
    mocks.createLLMGenerationTracingHook.mockReturnValue({ afterChat: vi.fn() });
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
      providerType: 'newapi',
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
      providerType: 'newapi',
    });
    expect(mocks.createLLMGenerationTracingHook).toHaveBeenCalledWith('user-1', 'newapi');
    expect(mocks.mergeModelRuntimeHooks).toHaveBeenCalledWith(
      expect.objectContaining({ beforeChat: expect.any(Function) }),
      expect.objectContaining({ afterChat: expect.any(Function) }),
    );
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

  it('should initialize provider-specific runtime for admin OpenAI-compatible instances', async () => {
    const db = { id: 'db' } as any;
    mocks.resolveNewapiInstancesForModel.mockResolvedValue([
      {
        apiKey: 'sk-deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        groupKey: 'default',
        instanceId: 'instance-deepseek',
        instanceName: 'DeepSeek',
        priority: 1,
        providerType: 'deepseek',
        source: 'instance' as const,
      },
    ]);

    await initModelRuntimeFromDB(db, 'user-1', 'newapi', {
      model: 'deepseek-chat',
      modelType: 'chat',
    });

    expect(mocks.initializeWithProvider).toHaveBeenCalledWith(
      'deepseek',
      expect.objectContaining({
        apiKey: 'sk-deepseek',
        baseURL: 'https://api.deepseek.com/v1',
        userId: 'user-1',
      }),
      expect.anything(),
    );
    expect(mocks.getBusinessModelRuntimeHooks).toHaveBeenCalledWith(
      'user-1',
      'newapi',
      expect.objectContaining({
        instanceId: 'instance-deepseek',
        providerType: 'deepseek',
      }),
    );
  });
});
