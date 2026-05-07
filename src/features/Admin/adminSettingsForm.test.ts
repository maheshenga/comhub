import { describe, expect, it } from 'vitest';

import {
  buildFormValues,
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
      brandAuthTitle: 'Agent teammates that grow with you',
      brandCopyrightText: '© 2026 青柚 AI. All rights reserved.',
      brandLogoUrl: '/logo.png',
      brandName: '青柚 AI',
      brandPrimaryColor: '#1677ff',
      brandSlogan: '',
      cronAuditRetentionDays: 365,
      cronPendingOrderExpiryDays: 7,
      cronSecret: '',
      defaultAgentAvatar: '/avatars/qingyou-ai.png',
      defaultAgentModel: 'gpt-4o-mini',
      defaultAgentName: '青柚助手',
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

  it('includes default assistant name and avatar in form values and updates', () => {
    const initial = buildFormValues({
      defaultAgentAvatar: '/images/brand/qingyou-ai-logo.png',
      defaultAgentName: '青柚助手',
    });

    expect(initial.defaultAgentName).toBe('青柚助手');
    expect(initial.defaultAgentAvatar).toBe('/images/brand/qingyou-ai-logo.png');

    expect(
      buildSettingUpdates(
        {
          ...initial,
          defaultAgentAvatar: '/images/brand/logo.svg',
          defaultAgentName: '青柚 AI 助手',
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.defaultAgentName, value: '青柚 AI 助手' },
      { key: SETTING_KEYS.defaultAgentAvatar, value: '/images/brand/logo.svg' },
    ]);
  });

  it('includes login page title and copyright in brand setting updates', () => {
    const initial = buildFormValues({
      brandAuthTitle: 'Agent teammates that grow with you',
      brandCopyrightText: '© 2026 青柚 AI. All rights reserved.',
    });

    expect(
      buildSettingUpdates(
        {
          ...initial,
          brandAuthTitle: '与团队一起成长的 AI 助手',
          brandCopyrightText: '© 2026 Qingyou AI',
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.brandAuthTitle, value: '与团队一起成长的 AI 助手' },
      { key: SETTING_KEYS.brandCopyrightText, value: '© 2026 Qingyou AI' },
    ]);
  });

  it('refreshes runtime config and user state when default assistant config changes', () => {
    expect(
      getAdminSettingsRefreshKeys([
        { key: SETTING_KEYS.defaultAgentModel, value: 'deepseek-chat' },
      ]),
    ).toEqual(['FETCH_SERVER_CONFIG', 'initUserState']);

    expect(
      getAdminSettingsRefreshKeys([{ key: SETTING_KEYS.defaultAgentName, value: '青柚助手' }]),
    ).toEqual(['FETCH_SERVER_CONFIG', 'initUserState']);

    expect(
      getAdminSettingsRefreshKeys([{ key: SETTING_KEYS.brandName, value: '青柚 AI' }]),
    ).toEqual([]);
  });

  it('shares the pricing model rules setting key with matrix-style admin pages', () => {
    expect(SETTING_KEYS.pricingModelRules).toBe('pricing.modelRules');
  });
});
