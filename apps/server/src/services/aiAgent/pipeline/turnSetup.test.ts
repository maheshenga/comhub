// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveNewTopicSnapshot } from './turnSetup';

const mocks = vi.hoisted(() => ({
  getModelReasoningConfig: vi.fn(),
  loadAdminModelDefaults: vi.fn(),
  resolveModelExtendParamsForUser: vi.fn(),
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

vi.mock('@/server/modules/AgentRuntime/adapters/serverCallLlmContextHints', () => ({
  resolveModelExtendParamsForUser: mocks.resolveModelExtendParamsForUser,
}));

const deps = { db: {} as any, userId: 'user-1' };
const agentConfig = { id: 'agent-1', model: 'gpt-5.6-sol', provider: 'openai' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveModelExtendParamsForUser.mockResolvedValue({
    modelHasReasoningExtendParams: true,
  });
  mocks.getModelReasoningConfig.mockResolvedValue(undefined);
  mocks.loadAdminModelDefaults.mockResolvedValue({
    contextWindow: new Map(),
    raw: { contextWindow: [], reasoning: [] },
    reasoning: new Map([['openai/gpt-5.6-sol', { gpt5_6ReasoningEffort: 'low' }]]),
    reasoningRecord: { 'openai/gpt-5.6-sol': { gpt5_6ReasoningEffort: 'low' } },
  });
});

describe('resolveNewTopicSnapshot reasoning snapshot', () => {
  it('snapshots the user config when the user saved one', async () => {
    mocks.getModelReasoningConfig.mockResolvedValue({ gpt5_6ReasoningEffort: 'high' });

    const snapshot = await resolveNewTopicSnapshot(deps, agentConfig);

    expect(snapshot.metadata).toEqual({ reasoningConfig: { gpt5_6ReasoningEffort: 'high' } });
    expect(mocks.loadAdminModelDefaults).not.toHaveBeenCalled();
  });

  it('snapshots the platform default when the user saved none', async () => {
    const snapshot = await resolveNewTopicSnapshot(deps, agentConfig);

    expect(snapshot.metadata).toEqual({ reasoningConfig: { gpt5_6ReasoningEffort: 'low' } });
  });

  it('treats an empty saved config as absent and snapshots the platform default', async () => {
    mocks.getModelReasoningConfig.mockResolvedValue({});

    const snapshot = await resolveNewTopicSnapshot(deps, agentConfig);

    expect(snapshot.metadata).toEqual({ reasoningConfig: { gpt5_6ReasoningEffort: 'low' } });
    expect(mocks.loadAdminModelDefaults).toHaveBeenCalled();
  });

  it('snapshots an empty config when neither source has one', async () => {
    mocks.loadAdminModelDefaults.mockResolvedValue({
      contextWindow: new Map(),
      raw: { contextWindow: [], reasoning: [] },
      reasoning: new Map(),
      reasoningRecord: {},
    });

    const snapshot = await resolveNewTopicSnapshot(deps, agentConfig);

    expect(snapshot.metadata).toEqual({ reasoningConfig: {} });
  });

  it('leaves metadata untouched for models without reasoning params', async () => {
    mocks.resolveModelExtendParamsForUser.mockResolvedValue({
      modelHasReasoningExtendParams: false,
    });

    const snapshot = await resolveNewTopicSnapshot(deps, agentConfig);

    expect(snapshot.metadata).toBeUndefined();
    expect(mocks.getModelReasoningConfig).not.toHaveBeenCalled();
    expect(mocks.loadAdminModelDefaults).not.toHaveBeenCalled();
  });
});
