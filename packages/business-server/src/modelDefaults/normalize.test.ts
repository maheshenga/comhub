import { describe, expect, it } from 'vitest';

import { MODEL_DEFAULTS_MAX_ENTRIES, normalizeModelDefaultsConfig } from './normalize';

describe('normalizeModelDefaultsConfig', () => {
  it('returns an empty config for non-object input', () => {
    for (const value of [null, undefined, 'model.defaults', 42, []]) {
      expect(normalizeModelDefaultsConfig(value)).toEqual({ contextWindow: [], reasoning: [] });
    }
  });

  it('deduplicates by provider/model (last wins) and sorts deterministically', () => {
    const result = normalizeModelDefaultsConfig({
      contextWindow: [
        { modelId: 'x', providerId: 'b', tokens: 100 },
        { modelId: 'y', providerId: 'a', tokens: 1 },
        { modelId: 'x', providerId: 'b', tokens: 200 },
      ],
      reasoning: [
        { config: { gpt5ReasoningEffort: 'high' }, modelId: 'x', providerId: 'b' },
        { config: { gpt5ReasoningEffort: 'low' }, modelId: 'x', providerId: 'b' },
      ],
    });

    expect(result.contextWindow).toEqual([
      { modelId: 'y', providerId: 'a', tokens: 1 },
      { modelId: 'x', providerId: 'b', tokens: 200 },
    ]);
    expect(result.reasoning).toEqual([
      { config: { gpt5ReasoningEffort: 'low' }, modelId: 'x', providerId: 'b' },
    ]);
  });

  it('drops context entries without ids or with invalid token counts', () => {
    const result = normalizeModelDefaultsConfig({
      contextWindow: [
        { modelId: '', providerId: 'p', tokens: 100 },
        { modelId: 'm', providerId: '  ', tokens: 100 },
        { modelId: 'm', providerId: 'p', tokens: -1 },
        { modelId: 'm', providerId: 'p', tokens: 'not-a-number' },
        { modelId: 'm', providerId: 'p', tokens: '' },
        { modelId: 'm', providerId: 'p', tokens: Number.POSITIVE_INFINITY },
        { modelId: '  padded  ', providerId: ' p ', tokens: '4096' },
        { modelId: 'zero', providerId: 'p', tokens: 0 },
      ],
    });

    expect(result.contextWindow).toEqual([
      { modelId: 'padded', providerId: 'p', tokens: 4096 },
      { modelId: 'zero', providerId: 'p', tokens: 0 },
    ]);
  });

  it('keeps only known reasoning params with valid levels and drops empty configs', () => {
    const result = normalizeModelDefaultsConfig({
      reasoning: [
        { config: { gpt5ReasoningEffort: 'ultra' }, modelId: 'invalid-level', providerId: 'p' },
        { config: null, modelId: 'null-config', providerId: 'p' },
        { config: 'high', modelId: 'string-config', providerId: 'p' },
        { modelId: 'missing-config', providerId: 'p' },
        {
          config: {
            gpt5ReasoningEffort: 'high',
            thinkingLevel: 'bogus',
            unknownParam: 'whatever',
          },
          modelId: 'filtered',
          providerId: 'p',
        },
      ],
    });

    expect(result.reasoning).toEqual([
      { config: { gpt5ReasoningEffort: 'high' }, modelId: 'filtered', providerId: 'p' },
    ]);
  });

  it('caps each list at the configured maximum', () => {
    const raw = {
      contextWindow: Array.from({ length: MODEL_DEFAULTS_MAX_ENTRIES + 1 }, (_, index) => ({
        modelId: `model-${index}`,
        providerId: 'p',
        tokens: index,
      })),
      reasoning: Array.from({ length: MODEL_DEFAULTS_MAX_ENTRIES + 1 }, (_, index) => ({
        config: { gpt5ReasoningEffort: 'high' } as const,
        modelId: `model-${index}`,
        providerId: 'p',
      })),
    };

    const result = normalizeModelDefaultsConfig(raw);

    expect(result.contextWindow).toHaveLength(MODEL_DEFAULTS_MAX_ENTRIES);
    expect(result.reasoning).toHaveLength(MODEL_DEFAULTS_MAX_ENTRIES);
    expect(normalizeModelDefaultsConfig(raw)).toEqual(result);
  });
});
