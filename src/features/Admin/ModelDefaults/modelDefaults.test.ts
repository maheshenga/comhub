import { MODEL_REASONING_PARAM_LEVELS } from 'model-bank/aiModel';
import { describe, expect, it } from 'vitest';

import {
  fromReasoningDraft,
  getModelReasoningParams,
  getReasoningLevelOptions,
  UNSET_REASONING_LEVEL,
} from './reasoningOptions';
import {
  buildModelDefaultsRows,
  formatContextTokens,
  formatReasoningSummary,
  type ModelDefaultsConfig,
} from './shared';
import {
  buildModelDefaultsUpdates,
  setContextWindowDefault,
  setReasoningDefaults,
} from './updates';

const chatModel = {
  displayName: 'Chat Model',
  extendParams: ['reasoningEffort', 'thinking'],
  instanceName: 'Chat Instance',
  modelId: 'chat-model',
  modelType: 'chat',
  provider: 'instance-1',
  providerType: 'newapi',
};

const embeddingModel = {
  displayName: 'Embedding Model',
  instanceName: 'Embedding Instance',
  modelId: 'embedding-model',
  modelType: 'embedding',
  provider: 'instance-2',
  providerType: 'newapi',
};

const imageModel = {
  displayName: 'Image Model',
  instanceName: 'Image Instance',
  modelId: 'image-model',
  modelType: 'image',
  provider: 'instance-3',
  providerType: 'newapi',
};

const config: ModelDefaultsConfig = {
  contextWindow: [{ modelId: 'chat-model', providerId: 'instance-1', tokens: 131_072 }],
  reasoning: [
    {
      config: { reasoningEffort: 'high' },
      modelId: 'chat-model',
      providerId: 'instance-1',
    },
  ],
};

describe('model defaults admin helpers', () => {
  it('lists only chat/embedding models and resolves their defaults', () => {
    const rows = buildModelDefaultsRows([chatModel, embeddingModel, imageModel], config);

    expect(rows.map((row) => row.key)).toEqual([
      'instance-1/chat-model',
      'instance-2/embedding-model',
    ]);
    expect(rows[0]).toMatchObject({
      contextTokens: 131_072,
      displayName: 'Chat Model',
      instanceLabel: 'Chat Instance',
      reasoningConfig: { reasoningEffort: 'high' },
    });
    expect(rows[1]).toMatchObject({ contextTokens: undefined, reasoningConfig: undefined });
  });

  it('formats context tokens with the slider unlimited position', () => {
    expect(formatContextTokens(undefined)).toBe('未设置');
    expect(formatContextTokens(0)).toBe('不限制');
    expect(formatContextTokens(131_072)).toBe('128K');
    expect(formatContextTokens(1_048_576)).toBe('1M');
    expect(formatContextTokens(100_000)).toBe('100000');
  });

  it('summarizes reasoning config by the model card params', () => {
    expect(formatReasoningSummary(undefined, [])).toBe('不适用');
    expect(formatReasoningSummary(undefined, ['reasoningEffort'])).toBe('未设置');
    expect(formatReasoningSummary({ reasoningEffort: 'high' }, ['reasoningEffort'])).toBe(
      'reasoningEffort: high',
    );
  });

  it('filters reasoning params through the model card extendParams', () => {
    expect(getModelReasoningParams(undefined)).toEqual([]);
    expect(getModelReasoningParams([])).toEqual([]);
    expect(getModelReasoningParams(['reasoningEffort', 'thinking', 'unknown'])).toEqual([
      'reasoningEffort',
    ]);
  });

  it('offers 未设置 as the first reasoning level option', () => {
    const options = getReasoningLevelOptions('reasoningEffort');

    expect(options[0]).toEqual({ label: '未设置', value: UNSET_REASONING_LEVEL });
    expect(options.slice(1).map((option) => option.value)).toEqual(
      MODEL_REASONING_PARAM_LEVELS.reasoningEffort,
    );
  });

  it('drops unset and unsupported reasoning keys from the draft', () => {
    expect(
      fromReasoningDraft({ reasoningEffort: 'high', thinkingLevel: 'high' }, ['reasoningEffort']),
    ).toEqual({ reasoningEffort: 'high' });
  });

  it('deletes context defaults and keeps entries sorted', () => {
    const removed = setContextWindowDefault(
      config,
      { modelId: 'chat-model', providerId: 'instance-1' },
      null,
    );
    expect(removed.contextWindow).toEqual([]);

    const added = setContextWindowDefault(removed, { modelId: 'b', providerId: 'z-provider' }, 0);
    const sorted = setContextWindowDefault(added, { modelId: 'a', providerId: 'a-provider' }, 4096);
    expect(sorted.contextWindow.map((entry) => entry.providerId)).toEqual([
      'a-provider',
      'z-provider',
    ]);
  });

  it('deletes empty reasoning defaults and removes them from the payload', () => {
    const next = setReasoningDefaults(
      config,
      { modelId: 'chat-model', providerId: 'instance-1' },
      {},
    );

    expect(next.reasoning).toEqual([]);
    expect(buildModelDefaultsUpdates(next)).toEqual({
      updates: [
        {
          key: 'model.defaults',
          value: {
            contextWindow: [{ modelId: 'chat-model', providerId: 'instance-1', tokens: 131_072 }],
            reasoning: [],
          },
        },
      ],
    });
  });

  it('keeps stored reasoning defaults when a context-only edit has no rendered reasoning keys', () => {
    // Replay the modal's handleOk sequence for a row whose card declares no
    // reasoning params (reasoningKeys = []): the guard must skip the reasoning
    // write so the stored default survives a context-window-only edit.
    const identity = { modelId: 'chat-model', providerId: 'instance-1' };
    const reasoningKeys = getModelReasoningParams(undefined);

    expect(reasoningKeys).toEqual([]);
    let next = setContextWindowDefault(config, identity, 262_144);
    if (reasoningKeys.length > 0) {
      next = setReasoningDefaults(next, identity, fromReasoningDraft({}, reasoningKeys));
    }

    expect(next.reasoning).toEqual([
      { config: { reasoningEffort: 'high' }, modelId: 'chat-model', providerId: 'instance-1' },
    ]);
    expect(next.contextWindow).toEqual([
      { modelId: 'chat-model', providerId: 'instance-1', tokens: 262_144 },
    ]);
  });

  it('sorts and deduplicates the persisted payload', () => {
    const payload = buildModelDefaultsUpdates({
      contextWindow: [
        { modelId: 'b', providerId: 'provider', tokens: 1 },
        { modelId: 'b', providerId: 'provider', tokens: 2 },
        { modelId: 'a', providerId: 'provider', tokens: 3 },
      ],
      reasoning: [
        { config: {}, modelId: 'b', providerId: 'provider' },
        {
          config: { thinkingLevel: 'high' },
          modelId: 'a',
          providerId: 'provider',
        },
      ],
    });

    expect(payload.updates[0].key).toBe('model.defaults');
    expect(payload.updates[0].value).toEqual({
      contextWindow: [
        { modelId: 'a', providerId: 'provider', tokens: 3 },
        { modelId: 'b', providerId: 'provider', tokens: 2 },
      ],
      reasoning: [{ config: { thinkingLevel: 'high' }, modelId: 'a', providerId: 'provider' }],
    });
  });
});
