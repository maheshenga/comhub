// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServerModelParamsProviders } from './providers';

const mocks = vi.hoisted(() => ({
  getModelReasoningConfig: vi.fn(),
  loadAdminModelDefaults: vi.fn(),
}));

vi.mock('@/business/server/modelDefaults', () => ({
  loadAdminModelDefaults: mocks.loadAdminModelDefaults,
  modelDefaultsKey: (providerId: string, modelId: string) => `${providerId}/${modelId}`,
}));

vi.mock('@/database/models/aiModel', () => ({
  AiModelModel: vi.fn().mockImplementation(function () {
    return { getModelReasoningConfig: mocks.getModelReasoningConfig };
  }),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

const createProviders = () =>
  createServerModelParamsProviders({
    builtinModels: [],
    serverDB: {} as any,
    userId: 'user-1',
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadAdminModelDefaults.mockResolvedValue({
    contextWindow: new Map(),
    raw: { contextWindow: [], reasoning: [] },
    reasoning: new Map([['openai/gpt-5.6-sol', { gpt5_6ReasoningEffort: 'low' }]]),
    reasoningRecord: { 'openai/gpt-5.6-sol': { gpt5_6ReasoningEffort: 'low' } },
  });
});

describe('createServerModelParamsProviders', () => {
  it('returns the user config without reading the platform defaults', async () => {
    mocks.getModelReasoningConfig.mockResolvedValue({ gpt5_6ReasoningEffort: 'high' });

    await expect(
      createProviders().getModelReasoningConfig!('gpt-5.6-sol', 'openai'),
    ).resolves.toEqual({ gpt5_6ReasoningEffort: 'high' });
    expect(mocks.loadAdminModelDefaults).not.toHaveBeenCalled();
  });

  it('falls back to the platform default when the user saved none', async () => {
    mocks.getModelReasoningConfig.mockResolvedValue(undefined);

    await expect(
      createProviders().getModelReasoningConfig!('gpt-5.6-sol', 'openai'),
    ).resolves.toEqual({ gpt5_6ReasoningEffort: 'low' });
  });

  it('treats an empty saved config as absent and uses the platform default', async () => {
    mocks.getModelReasoningConfig.mockResolvedValue({});

    await expect(
      createProviders().getModelReasoningConfig!('gpt-5.6-sol', 'openai'),
    ).resolves.toEqual({ gpt5_6ReasoningEffort: 'low' });
    expect(mocks.loadAdminModelDefaults).toHaveBeenCalled();
  });

  it('returns undefined when neither the user nor the platform set a config', async () => {
    mocks.getModelReasoningConfig.mockResolvedValue(undefined);

    await expect(
      createProviders().getModelReasoningConfig!('unknown-model', 'openai'),
    ).resolves.toBeUndefined();
  });

  it('does not expose reasoning lookups without a user scope', () => {
    const providers = createServerModelParamsProviders({ builtinModels: [] });

    expect(providers.getModelReasoningConfig).toBeUndefined();
  });
});
