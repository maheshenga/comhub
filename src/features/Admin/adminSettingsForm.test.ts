import { describe, expect, it } from 'vitest';

import {
  buildModelOptions,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
  SETTING_KEYS,
} from './adminSettingsForm';

describe('adminSettingsForm', () => {
  it('builds default model options from enabled NewAPI models and suggestions', () => {
    expect(
      buildModelOptions({
        defaultModelSuggestions: ['manual-chat', 'deepseek-chat'],
        enabledNewapiModels: [
          {
            displayName: 'DeepSeek Chat',
            instanceName: '主网关',
            modelId: 'deepseek-chat',
            modelType: 'chat',
            provider: 'newapi',
          },
          {
            displayName: null,
            instanceName: '图像网关',
            modelId: 'flux-kontext',
            modelType: 'image',
            provider: 'newapi',
          },
        ],
      }),
    ).toEqual([
      {
        label: 'DeepSeek Chat（newapi / chat / 主网关）',
        model: 'deepseek-chat',
        provider: 'newapi',
        value: 'newapi:deepseek-chat',
      },
      {
        label: 'flux-kontext（newapi / image / 图像网关）',
        model: 'flux-kontext',
        provider: 'newapi',
        value: 'newapi:flux-kontext',
      },
      {
        label: 'manual-chat（newapi / 建议）',
        model: 'manual-chat',
        provider: 'newapi',
        value: 'newapi:manual-chat',
      },
    ]);
  });

  it('builds app setting updates only for changed values', () => {
    const initial = {
      brandFaviconUrl: '',
      brandLogoUrl: '/logo.png',
      brandName: '青柚 AI',
      brandPrimaryColor: '#1677ff',
      brandSlogan: '',
      cronAuditRetentionDays: 365,
      cronPendingOrderExpiryDays: 7,
      cronSecret: '',
      defaultAgentModel: 'gpt-4o-mini',
      defaultAgentProvider: 'newapi',
      desktopDownloadLabel: '',
      desktopDownloadUrl: '',
      helpMenuItems: [],
      referralRewardCredits: 0,
    };

    expect(
      buildSettingUpdates(
        {
          ...initial,
          defaultAgentModel: 'deepseek-chat',
        },
        initial,
      ),
    ).toEqual([{ key: SETTING_KEYS.defaultAgentModel, value: 'deepseek-chat' }]);
  });

  it('refreshes runtime config and user state when default model or provider changes', () => {
    expect(
      getAdminSettingsRefreshKeys([
        { key: SETTING_KEYS.defaultAgentModel, value: 'deepseek-chat' },
      ]),
    ).toEqual(['FETCH_SERVER_CONFIG', 'initUserState']);

    expect(
      getAdminSettingsRefreshKeys([{ key: SETTING_KEYS.brandName, value: '青柚 AI' }]),
    ).toEqual([]);
  });

  it('shares the pricing model rules setting key with matrix-style admin pages', () => {
    expect(SETTING_KEYS.pricingModelRules).toBe('pricing.modelRules');
  });
});
