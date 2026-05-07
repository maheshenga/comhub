import { describe, expect, it } from 'vitest';

import {
  buildMatrixRows,
  buildPlanModelRulesFromRows,
  buildPricingRulesFromRows,
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
      defaultProvider: 'newapi',
      models,
      plans,
      planRulesByPlan: {
        free: { chat: { allowlist: ['deepseek-chat'], mode: 'allowlist' } },
        starter: { image: { blocklist: ['flux-*'], mode: 'blocklist' } },
      },
      pricingRules: [{ model: 'deepseek-chat', multiplier: 0.8, provider: 'newapi' }],
    });

    expect(rows).toEqual([
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
        isDefault: false,
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
});
