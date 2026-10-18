import { renderHook } from '@testing-library/react';
import type { AiModelReasoningConfig } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useModelEffortLabel } from './useModelEffortLabel';

const testState = vi.hoisted(() => ({
  adminConfig: undefined as AiModelReasoningConfig | undefined,
  config: undefined as AiModelReasoningConfig | undefined,
  ensureModelReasoningConfig: vi.fn(() => Promise.resolve()),
  loaded: false,
  reasoningParams: [] as string[],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/store/aiInfra', () => ({
  aiModelSelectors: {
    isModelReasoningConfigLoaded: () => (state: typeof testState) => state.loaded,
    modelEffectiveReasoningConfig: () => (state: typeof testState) =>
      state.config ?? state.adminConfig,
    modelReasoningExtendParams: () => (state: typeof testState) => state.reasoningParams,
  },
  useAiInfraStore: <T>(selector: (state: typeof testState) => T) => selector(testState),
}));

beforeEach(() => {
  testState.adminConfig = undefined;
  testState.config = undefined;
  testState.ensureModelReasoningConfig.mockClear();
  testState.loaded = true;
  testState.reasoningParams = ['gpt5ReasoningEffort'];
});

describe('useModelEffortLabel', () => {
  it('labels the platform default when the user saved none', () => {
    testState.adminConfig = { gpt5ReasoningEffort: 'low' };

    const { result } = renderHook(() => useModelEffortLabel('gpt-5', 'openai'));

    expect(result.current).toBe('reasoningEffort.levels.low');
  });

  it('prefers the user value over the platform default', () => {
    testState.config = { gpt5ReasoningEffort: 'high' };
    testState.adminConfig = { gpt5ReasoningEffort: 'low' };

    const { result } = renderHook(() => useModelEffortLabel('gpt-5', 'openai'));

    expect(result.current).toBe('reasoningEffort.levels.high');
  });

  it('falls back to the builtin level when neither source sets one', () => {
    const { result } = renderHook(() => useModelEffortLabel('gpt-5', 'openai'));

    expect(result.current).toBe('reasoningEffort.levels.medium');
  });

  it('returns undefined until the saved config is loaded', () => {
    testState.loaded = false;
    testState.adminConfig = { gpt5ReasoningEffort: 'low' };

    const { result } = renderHook(() => useModelEffortLabel('gpt-5', 'openai'));

    expect(result.current).toBeUndefined();
  });

  it('returns undefined for models without an effort param', () => {
    testState.reasoningParams = [];

    const { result } = renderHook(() => useModelEffortLabel('gpt-4o', 'openai'));

    expect(result.current).toBeUndefined();
    expect(testState.ensureModelReasoningConfig).not.toHaveBeenCalled();
  });
});
