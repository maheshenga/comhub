import { describe, expect, it } from 'vitest';

import {
  buildModelCatalog,
  getModelCatalogHealth,
  resolveVisibleAiProviderRuntimeState,
} from './visibleModels';

const createState = () =>
  ({
    enabledAiModels: [
      { enabled: true, groupKey: 'free', id: 'free-chat', providerId: 'newapi', type: 'chat' },
      { enabled: true, groupKey: 'pro', id: 'pro-chat', providerId: 'newapi', type: 'chat' },
      { enabled: true, groupKey: 'pro', id: 'pro-image', providerId: 'newapi', type: 'image' },
    ],
    enabledAiProviders: [{ id: 'newapi', name: 'AI Provider' }],
    enabledChatAiProviders: [{ id: 'newapi', name: 'AI Provider' }],
    enabledImageAiProviders: [{ id: 'newapi', name: 'AI Provider' }],
    enabledVideoAiProviders: [{ id: 'newapi', name: 'AI Provider' }],
    runtimeConfig: {},
  }) as any;

describe('visible model catalog', () => {
  it('explains models hidden by plan rules', () => {
    const catalog = buildModelCatalog({
      planRules: {
        chat: {
          allowlist: ['free:*'],
          mode: 'allowlist',
        },
      } as any,
      state: createState(),
    });

    expect(catalog.find((entry) => entry.model.id === 'free-chat')?.visible).toBe(true);
    expect(catalog.find((entry) => entry.model.id === 'pro-chat')?.visibilityReason).toMatchObject({
      code: 'disabled_by_plan_rule',
    });
  });

  it('returns a runtime state with providers recalculated from visible models', () => {
    const state = resolveVisibleAiProviderRuntimeState({
      planRules: {
        image: {
          allowlist: ['no-image'],
          mode: 'allowlist',
        },
      } as any,
      state: createState(),
    });

    expect(state.enabledAiModels.map((model) => model.id)).toEqual(['free-chat', 'pro-chat']);
    expect(state.enabledImageAiProviders).toEqual([]);
    expect(state.enabledChatAiProviders).toEqual([{ id: 'newapi', name: 'AI Provider' }]);
  });

  it('summarizes catalog health', () => {
    const catalog = buildModelCatalog({
      planRules: {
        chat: {
          allowlist: ['free:*'],
          mode: 'allowlist',
        },
      } as any,
      state: createState(),
    });

    expect(getModelCatalogHealth(catalog)).toMatchObject({
      hiddenByPlanCount: 1,
      totalCount: 3,
      visibleCount: 2,
    });
  });
});
