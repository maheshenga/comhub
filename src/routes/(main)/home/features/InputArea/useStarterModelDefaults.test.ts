import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NEW_CLAUDE_MODEL } from './starterModels';
import { useStarterModelDefaults } from './useStarterModelDefaults';

const mocks = vi.hoisted(() => ({
  enableBusinessFeatures: false,
}));

vi.mock('@/store/serverConfig', () => ({
  serverConfigSelectors: {
    enableBusinessFeatures: (state: { enableBusinessFeatures: boolean }) =>
      state.enableBusinessFeatures,
  },
  useServerConfigStore: <T>(selector: (state: { enableBusinessFeatures: boolean }) => T) =>
    selector({ enableBusinessFeatures: mocks.enableBusinessFeatures }),
}));

beforeEach(() => {
  mocks.enableBusinessFeatures = false;
});

describe('useStarterModelDefaults', () => {
  it('uses the OSS fallback home new model entries in the current product order', () => {
    const { result } = renderHook(() => useStarterModelDefaults());

    expect(NEW_CLAUDE_MODEL).toBe('claude-opus-5');
    expect(result.current.fallbackChatProvider).toBe('anthropic');
    expect(result.current.defaultHomeNewModels).toEqual([
      {
        model: 'claude-opus-5',
        provider: 'anthropic',
        title: 'Claude Opus 5',
        type: 'chat',
      },
      {
        model: 'gemini-3.6-flash',
        provider: 'google',
        title: 'Gemini 3.6 Flash',
        type: 'chat',
      },
      {
        model: 'qwen3.8-max-preview',
        provider: 'qwen',
        title: 'Qwen3.8 Max Preview',
        type: 'chat',
      },
      {
        model: 'kimi-k3',
        provider: 'moonshot',
        title: 'Kimi K3',
        type: 'chat',
      },
    ]);
  });

  it('uses the business fallback home new model entries in the current product order', () => {
    mocks.enableBusinessFeatures = true;

    const { result } = renderHook(() => useStarterModelDefaults());

    expect(result.current.fallbackChatProvider).toBe('newapi');
    expect(result.current.defaultHomeNewModels).toEqual([
      {
        model: 'claude-opus-5',
        provider: 'newapi',
        title: 'Claude Opus 5',
        type: 'chat',
      },
      {
        model: 'gemini-3.6-flash',
        provider: 'newapi',
        title: 'Gemini 3.6 Flash',
        type: 'chat',
      },
      {
        model: 'qwen3.8-max-preview',
        provider: 'newapi',
        title: 'Qwen3.8 Max Preview',
        type: 'chat',
      },
      {
        model: 'kimi-k3',
        provider: 'newapi',
        title: 'Kimi K3',
        type: 'chat',
      },
    ]);
  });
});
