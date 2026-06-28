import { describe, expect, it } from 'vitest';

import {
  buildMatrixRows,
  buildPlanModelRulesFromRows,
  buildPricingRulesFromRows,
  findFreePlanDefaultModelConflict,
  getDefaultModelHealth,
  getMatrixConfigHealth,
  getMatrixConfigHealthFocus,
  togglePlanAccess,
} from './adminModelBillingMatrix';

describe('adminModelBillingMatrix', () => {
  const plans = [
    { displayName: 'Free', plan: 'free' },
    { displayName: 'Starter', plan: 'starter' },
  ];

  const models = [
    {
      displayName: 'DeepSeek Chat',
      instanceId: 'inst-1',
      instanceName: '主网关',
      modelId: 'deepseek-chat',
      modelType: 'chat' as const,
      priority: 0,
    },
    {
      displayName: 'DeepSeek Chat Backup',
      instanceId: 'inst-2',
      instanceName: '备用网关',
      modelId: 'deepseek-chat',
      modelType: 'chat' as const,
      priority: 1,
    },
    {
      displayName: null,
      instanceId: 'inst-3',
      instanceName: '图像网关',
      modelId: 'flux-kontext',
      modelType: 'image' as const,
      priority: 0,
    },
  ];

  it('deduplicates models and marks default/pricing/plan access', () => {
    const rows = buildMatrixRows({
      defaultModel: 'deepseek-chat',
      defaultModelsByType: {
        image: { model: 'flux-kontext', provider: 'newapi' },
      },
      defaultProvider: 'newapi',
      models,
      plans,
      planRulesByPlan: {
        free: { chat: { allowlist: ['deepseek-chat'], mode: 'allowlist' } },
        starter: { image: { blocklist: ['flux-*'], mode: 'blocklist' } },
      },
      pricingRules: [{ model: 'deepseek-chat', multiplier: 0.8, provider: 'newapi' }],
    });

    expect(rows).toMatchObject([
      {
        creditsPerDollar: undefined,
        displayName: 'DeepSeek Chat',
        instanceNames: ['主网关', '备用网关'],
        isDefault: true,
        key: 'newapi:chat:deepseek-chat',
        modelId: 'deepseek-chat',
        modelType: 'chat',
        planAccess: { free: true, starter: true },
        pricingMultiplier: 0.8,
        provider: 'newapi',
      },
      {
        creditsPerDollar: undefined,
        displayName: 'flux-kontext',
        instanceNames: ['图像网关'],
        isDefault: true,
        key: 'newapi:image:flux-kontext',
        modelId: 'flux-kontext',
        modelType: 'image',
        planAccess: { free: true, starter: false },
        pricingMultiplier: undefined,
        provider: 'newapi',
      },
    ]);
  });

  it('toggles plan access and serializes allowlist rules by plan/type', () => {
    const rows = buildMatrixRows({
      models,
      plans,
      planRulesByPlan: {},
      pricingRules: [],
    });
    const nextRows = togglePlanAccess(rows, 'newapi:image:flux-kontext', 'starter', false);

    expect(buildPlanModelRulesFromRows(nextRows, plans)).toEqual({
      free: undefined,
      starter: {
        image: { allowlist: [], mode: 'allowlist' },
      },
    });
  });

  it('keeps newapi groups as separate matrix rows and serializes group-qualified access rules', () => {
    const rows = buildMatrixRows({
      models: [
        {
          displayName: 'GPT Basic',
          groupKey: 'basic',
          groupName: 'Basic Group',
          instanceId: 'inst-basic',
          instanceName: 'Basic Gateway',
          modelId: 'gpt-4o-mini',
          modelType: 'chat',
          priority: 0,
        },
        {
          displayName: 'GPT Pro',
          groupKey: 'pro',
          groupName: 'Pro Group',
          instanceId: 'inst-pro',
          instanceName: 'Pro Gateway',
          modelId: 'gpt-4o-mini',
          modelType: 'chat',
          priority: 0,
        },
      ],
      plans,
      planRulesByPlan: {
        free: { chat: { allowlist: ['basic:gpt-4o-mini'], mode: 'allowlist' } },
        starter: { chat: { allowlist: ['pro:gpt-4o-mini'], mode: 'allowlist' } },
      },
      pricingRules: [],
    });

    expect(rows.map((row) => row.key)).toEqual([
      'newapi:basic:chat:gpt-4o-mini',
      'newapi:pro:chat:gpt-4o-mini',
    ]);
    expect(rows.map((row) => row.planAccess)).toEqual([
      { free: true, starter: false },
      { free: false, starter: true },
    ]);

    const starterProOnly = togglePlanAccess(
      rows,
      'newapi:basic:chat:gpt-4o-mini',
      'starter',
      false,
    );
    expect(buildPlanModelRulesFromRows(starterProOnly, plans).starter).toEqual({
      chat: { allowlist: ['pro:gpt-4o-mini'], mode: 'allowlist' },
    });
  });

  it('serializes pricing rules only for rows with overrides', () => {
    const rows = buildMatrixRows({
      models,
      plans,
      planRulesByPlan: {},
      pricingRules: [],
    }).map((row) =>
      row.modelId === 'deepseek-chat'
        ? { ...row, creditsPerDollar: 1_000_000, pricingMultiplier: 0.9 }
        : row,
    );

    expect(buildPricingRulesFromRows(rows)).toEqual([
      {
        creditsPerDollar: 1_000_000,
        model: 'deepseek-chat',
        multiplier: 0.9,
        provider: 'newapi',
      },
    ]);
  });

  it('serializes pricing rules with group keys', () => {
    const rows = buildMatrixRows({
      models: [
        {
          displayName: 'GPT Pro',
          groupKey: 'pro',
          groupName: 'Pro Group',
          instanceId: 'inst-pro',
          instanceName: 'Pro Gateway',
          modelId: 'gpt-4o-mini',
          modelType: 'chat',
          priority: 0,
        },
      ],
      plans,
      planRulesByPlan: {},
      pricingRules: [],
    }).map((row) => ({ ...row, pricingMultiplier: 1.4 }));

    expect(buildPricingRulesFromRows(rows)).toEqual([
      {
        group: 'pro',
        model: 'gpt-4o-mini',
        multiplier: 1.4,
        provider: 'newapi',
      },
    ]);
  });

  it('matches and serializes provider-type and single-instance pricing rules', () => {
    const rows = buildMatrixRows({
      models: [
        {
          displayName: 'DeepSeek Chat',
          groupKey: 'pro',
          groupName: 'Pro Group',
          instanceId: 'inst-deepseek',
          instanceName: 'DeepSeek Gateway',
          modelId: 'deepseek-chat',
          modelType: 'chat',
          priority: 0,
          providerType: 'deepseek',
        },
      ],
      plans,
      planRulesByPlan: {},
      pricingRules: [
        {
          instanceId: 'inst-deepseek',
          model: 'deepseek-chat',
          multiplier: 1.8,
          provider: 'newapi',
          providerType: 'deepseek',
        },
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        instanceIds: ['inst-deepseek'],
        pricingMultiplier: 1.8,
        providerType: 'deepseek',
        providerTypes: ['deepseek'],
      }),
    );
    expect(buildPricingRulesFromRows(rows)).toEqual([
      {
        group: 'pro',
        instanceId: 'inst-deepseek',
        model: 'deepseek-chat',
        multiplier: 1.8,
        provider: 'newapi',
        providerType: 'deepseek',
      },
    ]);
  });

  it('detects when the current default chat model is disabled for the Free plan', () => {
    const rows = buildMatrixRows({
      defaultModel: 'deepseek-chat',
      defaultProvider: 'newapi',
      models,
      plans,
      planRulesByPlan: {},
      pricingRules: [],
    });
    const nextRows = togglePlanAccess(rows, 'newapi:chat:deepseek-chat', 'free', false);

    expect(findFreePlanDefaultModelConflict(nextRows)).toEqual({
      displayName: 'DeepSeek Chat',
      modelId: 'deepseek-chat',
      modelType: 'chat',
      provider: 'newapi',
    });
  });

  it('does not report a default conflict when at least one matching group is available to Free', () => {
    const rows = buildMatrixRows({
      defaultModel: 'gpt-4o-mini',
      defaultProvider: 'newapi',
      models: [
        {
          displayName: 'GPT Basic',
          groupKey: 'basic',
          groupName: 'Basic Group',
          instanceId: 'inst-basic',
          instanceName: 'Basic Gateway',
          modelId: 'gpt-4o-mini',
          modelType: 'chat',
          priority: 0,
        },
        {
          displayName: 'GPT Pro',
          groupKey: 'pro',
          groupName: 'Pro Group',
          instanceId: 'inst-pro',
          instanceName: 'Pro Gateway',
          modelId: 'gpt-4o-mini',
          modelType: 'chat',
          priority: 0,
        },
      ],
      plans,
      planRulesByPlan: {
        free: { chat: { allowlist: ['basic:gpt-4o-mini'], mode: 'allowlist' } },
      },
      pricingRules: [],
    });

    expect(findFreePlanDefaultModelConflict(rows)).toBeNull();
    expect(
      getDefaultModelHealth(rows, {
        chat: { model: 'gpt-4o-mini', provider: 'newapi' },
      }).chat,
    ).toEqual(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        status: 'ok',
      }),
    );
  });

  it('detects when the current default image model is disabled for the Free plan', () => {
    const rows = buildMatrixRows({
      defaultModelsByType: {
        image: { model: 'flux-kontext', provider: 'newapi' },
      },
      models,
      plans,
      planRulesByPlan: {},
      pricingRules: [],
    });
    const nextRows = togglePlanAccess(rows, 'newapi:image:flux-kontext', 'free', false);

    expect(findFreePlanDefaultModelConflict(nextRows)).toEqual({
      displayName: 'flux-kontext',
      modelId: 'flux-kontext',
      modelType: 'image',
      provider: 'newapi',
    });
  });

  it('reports default model health for configured chat/image/video defaults', () => {
    const rows = buildMatrixRows({
      defaultModel: 'deepseek-chat',
      defaultModelsByType: {
        image: { model: 'flux-kontext', provider: 'newapi' },
        video: { model: 'veo-3', provider: 'newapi' },
      },
      defaultProvider: 'newapi',
      models: [
        ...models,
        {
          displayName: 'Veo 3',
          instanceId: 'inst-video',
          instanceName: 'Video Gateway',
          modelId: 'veo-3',
          modelType: 'video' as const,
          priority: 0,
        },
      ],
      plans,
      planRulesByPlan: {
        free: { video: { blocklist: ['veo-3'], mode: 'blocklist' } },
      },
      pricingRules: [],
    });

    expect(
      getDefaultModelHealth(rows, {
        chat: { model: 'deepseek-chat', provider: 'newapi' },
        image: { model: 'flux-kontext', provider: 'newapi' },
        video: { model: 'veo-3', provider: 'newapi' },
      }),
    ).toEqual({
      chat: expect.objectContaining({
        displayName: 'DeepSeek Chat',
        model: 'deepseek-chat',
        provider: 'newapi',
        status: 'ok',
      }),
      image: expect.objectContaining({
        displayName: 'flux-kontext',
        model: 'flux-kontext',
        provider: 'newapi',
        status: 'ok',
      }),
      video: expect.objectContaining({
        displayName: 'Veo 3',
        model: 'veo-3',
        provider: 'newapi',
        status: 'denied_by_free_plan',
      }),
    });
  });

  it('reports missing, disabled, and type-mismatched default models', () => {
    const rows = buildMatrixRows({
      models,
      plans,
      planRulesByPlan: {},
      pricingRules: [],
    });

    expect(
      getDefaultModelHealth(rows, {
        chat: { model: '', provider: 'newapi' },
        image: { model: 'deepseek-chat', provider: 'newapi' },
        video: { model: 'veo-3', provider: 'newapi' },
      }),
    ).toEqual({
      chat: expect.objectContaining({
        provider: 'newapi',
        status: 'not_configured',
      }),
      image: expect.objectContaining({
        actualModelType: 'chat',
        model: 'deepseek-chat',
        provider: 'newapi',
        status: 'type_mismatch',
      }),
      video: expect.objectContaining({
        model: 'veo-3',
        provider: 'newapi',
        status: 'not_enabled',
      }),
    });
  });

  it('summarizes matrix configuration health risks', () => {
    const rows = buildMatrixRows({
      defaultModel: 'deepseek-chat',
      defaultProvider: 'newapi',
      models,
      plans,
      planRulesByPlan: {
        free: {
          chat: { allowlist: ['deepseek-chat'], mode: 'allowlist' },
          image: { allowlist: [], mode: 'allowlist' },
        },
        starter: {
          chat: { allowlist: [], mode: 'allowlist' },
          image: { allowlist: [], mode: 'allowlist' },
        },
      },
      pricingRules: [{ model: 'deepseek-chat', multiplier: 0.8, provider: 'newapi' }],
    });
    const health = getMatrixConfigHealth({
      defaultModelHealth: getDefaultModelHealth(rows, {
        chat: { model: 'deepseek-chat', provider: 'newapi' },
        image: { model: 'flux-kontext', provider: 'newapi' },
        video: { model: 'veo-3', provider: 'newapi' },
      }),
      globalPricingMultiplier: 1,
      plans,
      rows,
    });

    expect(health.status).toBe('error');
    expect(health.summary).toMatchObject({
      blockedModelCount: 1,
      defaultModelIssueCount: 2,
      modelCount: 2,
      planCount: 2,
      plansWithoutAccessCount: 1,
      pricingFallbackModelCount: 1,
      pricingOverrideCount: 1,
    });
    expect(health.checks.map((check) => check.key)).toEqual([
      'default-models',
      'plans-without-models',
      'blocked-models',
      'pricing-fallbacks',
    ]);
  });

  it('finds matrix rows and plans related to health checks', () => {
    const rows = buildMatrixRows({
      defaultModel: 'deepseek-chat',
      defaultProvider: 'newapi',
      models,
      plans,
      planRulesByPlan: {
        free: {
          chat: { allowlist: ['deepseek-chat'], mode: 'allowlist' },
          image: { allowlist: [], mode: 'allowlist' },
        },
        starter: {
          chat: { allowlist: [], mode: 'allowlist' },
          image: { allowlist: [], mode: 'allowlist' },
        },
      },
      pricingRules: [{ model: 'deepseek-chat', multiplier: 0.8, provider: 'newapi' }],
    });
    const defaultModelHealth = getDefaultModelHealth(rows, {
      chat: { model: 'deepseek-chat', provider: 'newapi' },
      image: { model: 'flux-kontext', provider: 'newapi' },
      video: { model: 'veo-3', provider: 'newapi' },
    });

    expect(
      getMatrixConfigHealthFocus({
        checkKey: 'plans-without-models',
        defaultModelHealth,
        plans,
        rows,
      }),
    ).toEqual({
      planKeys: ['starter'],
      rowKeys: ['newapi:chat:deepseek-chat', 'newapi:image:flux-kontext'],
    });
    expect(
      getMatrixConfigHealthFocus({
        checkKey: 'blocked-models',
        defaultModelHealth,
        plans,
        rows,
      }),
    ).toEqual({
      planKeys: ['free', 'starter'],
      rowKeys: ['newapi:image:flux-kontext'],
    });
    expect(
      getMatrixConfigHealthFocus({
        checkKey: 'pricing-fallbacks',
        defaultModelHealth,
        plans,
        rows,
      }),
    ).toEqual({
      planKeys: [],
      rowKeys: ['newapi:image:flux-kontext'],
    });
    expect(
      getMatrixConfigHealthFocus({
        checkKey: 'default-models',
        defaultModelHealth,
        plans,
        rows,
      }),
    ).toEqual({
      planKeys: ['free'],
      rowKeys: ['newapi:image:flux-kontext'],
    });
  });
});
