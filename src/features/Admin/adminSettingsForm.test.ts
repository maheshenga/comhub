import { describe, expect, it } from 'vitest';

import {
  buildFormValues,
  buildModelOptions,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
  SETTING_KEYS,
} from './adminSettingsForm';

describe('adminSettingsForm', () => {
  it('builds default model options from enabled provider models and suggestions', () => {
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
      brandLoadingText: 'Loading',
      brandName: '青柚 AI',
      brandPrimaryColor: '#1677ff',
      brandSlogan: '',
      aboutLinks: {
        contact: [],
        information: [],
        legal: [],
      },
      cronAuditRetentionDays: 365,
      cronPendingOrderExpiryDays: 7,
      cronSecret: '',
      defaultAgentAvatar: '/avatars/qingyou-ai.png',
      defaultAgentModel: 'gpt-4o-mini',
      defaultAgentName: '青柚助手',
      defaultAgentProvider: 'newapi',
      defaultImageModel: 'flux-pro',
      defaultImageProvider: 'newapi',
      defaultSkillName: 'LobeHub',
      defaultVideoModel: 'sora-2',
      defaultVideoProvider: 'newapi',
      desktopDownloadLabel: '',
      desktopDownloadUrl: '',
      helpMenuItems: [],
      ordersEnabled: true,
      pricingMultiplier: 1,
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

  it('includes default image and video models in form values and updates', () => {
    const initial = buildFormValues({
      defaultImageModel: 'flux-pro',
      defaultImageProvider: 'newapi',
      defaultVideoModel: 'sora-2',
      defaultVideoProvider: 'newapi',
    });

    expect(initial.defaultImageModel).toBe('flux-pro');
    expect(initial.defaultImageProvider).toBe('newapi');
    expect(initial.defaultVideoModel).toBe('sora-2');
    expect(initial.defaultVideoProvider).toBe('newapi');

    expect(
      buildSettingUpdates(
        {
          ...initial,
          defaultImageModel: 'flux-kontext',
          defaultVideoModel: 'kling-v2',
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.defaultImageModel, value: 'flux-kontext' },
      { key: SETTING_KEYS.defaultVideoModel, value: 'kling-v2' },
    ]);
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

  it('includes default skill name in form values and updates', () => {
    const initial = buildFormValues({
      defaultSkillName: 'LobeHub',
    });

    expect(initial.defaultSkillName).toBe('LobeHub');

    expect(
      buildSettingUpdates(
        {
          ...initial,
          defaultSkillName: '玄果技能',
        },
        initial,
      ),
    ).toEqual([{ key: SETTING_KEYS.defaultSkillName, value: '玄果技能' }]);
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

  it('keeps loading copy separate from login and slogan copy', () => {
    const initial = buildFormValues({
      brandAuthTitle: 'Login page copy',
      brandLoadingText: 'Loading copy',
      brandSlogan: 'Legacy slogan',
    });

    expect(initial.brandAuthTitle).toBe('Login page copy');
    expect(initial.brandLoadingText).toBe('Loading copy');
    expect(initial.brandSlogan).toBe('Legacy slogan');

    expect(
      buildSettingUpdates(
        {
          ...initial,
          brandLoadingText: 'Only this appears while loading',
        },
        initial,
      ),
    ).toEqual([{ key: SETTING_KEYS.brandLoadingText, value: 'Only this appears while loading' }]);
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
    ).toEqual(['brand-config']);
  });

  it('shares the pricing model rules setting key with matrix-style admin pages', () => {
    expect(SETTING_KEYS.pricingModelRules).toBe('pricing.modelRules');
  });

  it('includes global billing controls in site setting updates', () => {
    const initial = buildFormValues({
      ordersManagementEnabled: true,
      pricingCreditMultiplier: 1,
    });

    expect(initial.ordersEnabled).toBe(true);
    expect(initial.pricingMultiplier).toBe(1);

    expect(
      buildSettingUpdates(
        {
          ...initial,
          ordersEnabled: false,
          pricingMultiplier: 1.35,
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.pricingCreditMultiplier, value: 1.35 },
      { key: SETTING_KEYS.ordersManagementEnabled, value: false },
    ]);
  });

  it('saves about page links as one shared setting', () => {
    const initial = buildFormValues({
      aboutLinks: {
        contact: [{ id: 'officialSite', label: '官方网站', url: 'https://lobehub.com' }],
        information: [],
        legal: [],
      },
    });

    expect(
      buildSettingUpdates(
        {
          ...initial,
          aboutLinks: {
            ...initial.aboutLinks,
            contact: [{ id: 'officialSite', label: '青柚官网', url: 'https://chat.qingyouai.com' }],
          },
        },
        initial,
      ),
    ).toEqual([
      {
        key: SETTING_KEYS.aboutLinks,
        value: {
          ...initial.aboutLinks,
          contact: [
            { id: 'officialSite', label: '青柚官网', url: 'https://chat.qingyouai.com' },
            ...initial.aboutLinks.contact.slice(1),
          ],
        },
      },
    ]);
  });
});
