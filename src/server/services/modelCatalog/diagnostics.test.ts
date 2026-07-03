import { describe, expect, it } from 'vitest';

import { getModelCatalogDiagnostics } from './diagnostics';

const createState = (models: any[]) =>
  ({
    enabledAiModels: models,
    enabledAiProviders: [{ id: 'newapi', name: 'AI Provider' }],
    enabledChatAiProviders: [{ id: 'newapi', name: 'AI Provider' }],
    enabledImageAiProviders: [],
    enabledVideoAiProviders: [],
    runtimeConfig: {},
  }) as any;

describe('model catalog diagnostics', () => {
  it('reports an error when no enabled models exist', () => {
    const diagnostics = getModelCatalogDiagnostics({ state: createState([]) });

    expect(diagnostics.health.totalCount).toBe(0);
    expect(diagnostics.risks).toContainEqual(
      expect.objectContaining({ key: 'no_models', level: 'error' }),
    );
  });

  it('reports hidden models and duplicate model keys', () => {
    const diagnostics = getModelCatalogDiagnostics({
      planRules: {
        chat: {
          allowlist: ['pro:*'],
          mode: 'allowlist',
        },
      } as any,
      state: createState([
        { enabled: true, groupKey: 'free', id: 'shared-chat', providerId: 'newapi', type: 'chat' },
        { enabled: true, groupKey: 'pro', id: 'shared-chat', providerId: 'newapi', type: 'chat' },
      ]),
    });

    expect(diagnostics.health).toMatchObject({
      hiddenByPlanCount: 1,
      totalCount: 2,
      visibleCount: 1,
    });
    expect(diagnostics.hiddenByReason).toEqual({ disabled_by_plan_rule: 1 });
    expect(diagnostics.risks).toContainEqual(
      expect.objectContaining({
        key: 'duplicate:newapi:shared-chat:chat',
        level: 'warning',
      }),
    );
  });
});
