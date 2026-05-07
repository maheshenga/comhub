import { describe, expect, it } from 'vitest';

import {
  buildModelOptions,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
  normalizeGatewayUrls,
  normalizeModelIds,
  SETTING_KEYS,
} from './adminSettingsForm';

describe('adminSettingsForm', () => {
  it('normalizes model ids and gateway urls before saving', () => {
    expect(normalizeModelIds('gpt-4o-mini\ngpt-4o-mini, deepseek-chat')).toBe(
      'gpt-4o-mini\ndeepseek-chat',
    );
    expect(
      normalizeGatewayUrls(
        'https://a.example.com/v1/\nhttps://a.example.com/v1; https://b.example.com',
      ),
    ).toBe('https://a.example.com/v1\nhttps://b.example.com');
  });

  it('builds default model options from enabled NewAPI models and legacy suggestions', () => {
    expect(
      buildModelOptions({
        defaultModelSuggestions: ['legacy-chat', 'deepseek-chat'],
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
        label: 'legacy-chat（newapi / legacy）',
        model: 'legacy-chat',
        provider: 'newapi',
        value: 'newapi:legacy-chat',
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
      newapiApiKey: '',
      newapiEnabledModels: 'gpt-4o-mini',
      newapiProxyUrl: 'https://a.example.com/v1',
      referralRewardCredits: 0,
    };

    expect(
      buildSettingUpdates(
        {
          ...initial,
          defaultAgentModel: 'deepseek-chat',
          newapiApiKey: 'sk-test',
          newapiEnabledModels: 'gpt-4o-mini, deepseek-chat',
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.newapiApiKey, value: 'sk-test' },
      { key: SETTING_KEYS.newapiEnabledModels, value: 'gpt-4o-mini\ndeepseek-chat' },
      { key: SETTING_KEYS.defaultAgentModel, value: 'deepseek-chat' },
    ]);
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
});
