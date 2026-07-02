import { describe, expect, it } from 'vitest';

import {
  buildFormValues,
  buildModelOptions,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
  resolveModelOptionValue,
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

  it('resolves a legacy provider id model value to the unique enabled model option', () => {
    const options = buildModelOptions({
      enabledNewapiModels: [
        {
          displayName: 'DeepSeek Chat',
          instanceName: 'Primary Gateway',
          modelId: 'deepseek-chat',
          modelType: 'chat',
          provider: 'newapi',
        },
      ],
    });

    expect(
      resolveModelOptionValue({ model: 'deepseek-chat', provider: '1234567890' }, options),
    ).toBe('newapi:deepseek-chat');
  });

  it('builds app setting updates only for changed values', () => {
    const initial = {
      ...buildFormValues(),
      brandFaviconUrl: '',
      brandAuthTitle: 'Agent teammates that grow with you',
      brandCopyrightText: '© 2026 青柚 AI. All rights reserved.',
      brandLogoUrl: '/logo.png',
      brandLoadingText: 'Loading',
      brandLoadingSvgUrl: '',
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
      memoryUserMemoryTriggerMode: 'auto' as const,
      ordersEnabled: true,
      pricingMultiplier: 1,
      profileInterestAreas: [],
      referralRewardCredits: 0,
      sidebarGenerationLabel: '生成',
      sidebarMemberLabel: '会员',
      sidebarMemberUrl: '/settings/plans',
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

  it('includes home messenger controls and community fork copy in brand setting updates', () => {
    const initial = buildFormValues({
      communityForkAndChatLabel: '',
      homeMessengerEnabled: true,
      homeMessengerBannerTitle: '',
    });

    expect(
      buildSettingUpdates(
        {
          ...initial,
          communityForkAndChatLabel: '立即派生',
          homeMessengerEnabled: false,
          homeMessengerBannerTitle: '在聊天平台中，与 {{brandName}} 畅聊',
        },
        initial,
      ),
    ).toEqual([
      {
        key: SETTING_KEYS.homeMessengerBannerTitle,
        value: '在聊天平台中，与 {{brandName}} 畅聊',
      },
      { key: SETTING_KEYS.homeMessengerEnabled, value: false },
      { key: SETTING_KEYS.communityForkAndChatLabel, value: '立即派生' },
    ]);

    expect(
      getAdminSettingsRefreshKeys([
        {
          key: SETTING_KEYS.homeMessengerBannerTitle,
          value: '在聊天平台中，与 {{brandName}} 畅聊',
        },
      ]),
    ).toEqual(['brand-config']);
  });

  it('includes sidebar member and generation labels in brand setting updates', () => {
    const initial = buildFormValues({
      sidebarGenerationLabel: '生成',
      sidebarMemberLabel: '会员',
      sidebarMemberUrl: '/settings/plans',
    });

    expect(
      buildSettingUpdates(
        {
          ...initial,
          sidebarGenerationLabel: '创作',
          sidebarMemberLabel: '会员中心',
          sidebarMemberUrl: '/settings/plans?tab=vip',
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.sidebarMemberLabel, value: '会员中心' },
      { key: SETTING_KEYS.sidebarMemberUrl, value: '/settings/plans?tab=vip' },
      { key: SETTING_KEYS.sidebarGenerationLabel, value: '创作' },
    ]);

    expect(
      getAdminSettingsRefreshKeys([{ key: SETTING_KEYS.sidebarMemberLabel, value: '会员中心' }]),
    ).toEqual(['brand-config']);
  });

  it('keeps loading copy separate from login and slogan copy', () => {
    const initial = buildFormValues({
      brandAuthTitle: 'Login page copy',
      brandLoadingText: 'Loading copy',
      brandLoadingSvgUrl: '',
      brandSlogan: 'Legacy slogan',
    });

    expect(initial.brandAuthTitle).toBe('Login page copy');
    expect(initial.brandLoadingText).toBe('Loading copy');
    expect(initial.brandLoadingSvgUrl).toBe('');
    expect(initial.brandSlogan).toBe('Legacy slogan');

    expect(
      buildSettingUpdates(
        {
          ...initial,
          brandLoadingText: 'Only this appears while loading',
          brandLoadingSvgUrl: 'https://cdn.example.com/loading.svg',
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.brandLoadingText, value: 'Only this appears while loading' },
      { key: SETTING_KEYS.brandLoadingSvgUrl, value: 'https://cdn.example.com/loading.svg' },
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
    ).toEqual(['brand-config']);
  });

  it('shares the pricing model rules setting key with matrix-style admin pages', () => {
    expect(SETTING_KEYS.pricingModelRules).toBe('pricing.modelRules');
  });

  it('shares profile interest setting key with admin-managed profile options', () => {
    expect(SETTING_KEYS.profileInterestAreas).toBe('profile.interestAreas');
  });

  it('shares notification preference keys with admin notification controls', () => {
    expect(SETTING_KEYS.notificationPushEnabled).toBe('notification.push.enabled');
    expect(SETTING_KEYS.notificationEventDefaults).toBe('notification.eventDefaults');
  });

  it('includes memory trigger mode in system maintenance settings', () => {
    const initial = buildFormValues({
      memoryUserMemoryTriggerMode: 'auto',
    });

    expect(initial.memoryUserMemoryTriggerMode).toBe('auto');

    expect(
      buildSettingUpdates(
        {
          ...initial,
          memoryUserMemoryTriggerMode: 'direct',
        },
        initial,
      ),
    ).toEqual([{ key: SETTING_KEYS.memoryUserMemoryTriggerMode, value: 'direct' }]);
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

  it('includes S3 storage settings in site setting updates while keeping the secret write-only', () => {
    const initial = buildFormValues({
      storageS3AccessKeyId: 'env-access-key',
      storageS3Bucket: 'env-bucket',
      storageS3EnablePathStyle: false,
      storageS3Endpoint: 'https://env-s3.example.com',
      storageS3FilePath: 'env-files',
      storageS3PreviewUrlExpireIn: 7200,
      storageS3PublicDomain: '',
      storageS3Region: 'us-east-1',
      storageS3SecretAccessKeyConfigured: true,
      storageS3SetAcl: true,
    });

    expect(initial.storageS3SecretAccessKey).toBe('');
    expect(initial.storageS3SecretAccessKeyConfigured).toBe(true);

    expect(
      buildSettingUpdates(
        {
          ...initial,
          storageS3AccessKeyId: 'admin-access-key',
          storageS3Bucket: 'admin-bucket',
          storageS3EnablePathStyle: true,
          storageS3Endpoint: 'https://admin-s3.example.com',
          storageS3FilePath: '/admin-files/',
          storageS3PreviewUrlExpireIn: 1800,
          storageS3PublicDomain: 'https://cdn.example.com',
          storageS3Region: 'ap-southeast-1',
          storageS3SecretAccessKey: 'new-secret',
          storageS3SetAcl: false,
        },
        initial,
      ),
    ).toEqual([
      { key: SETTING_KEYS.storageS3AccessKeyId, value: 'admin-access-key' },
      { key: SETTING_KEYS.storageS3SecretAccessKey, value: 'new-secret' },
      { key: SETTING_KEYS.storageS3Endpoint, value: 'https://admin-s3.example.com' },
      { key: SETTING_KEYS.storageS3FilePath, value: 'admin-files' },
      { key: SETTING_KEYS.storageS3Bucket, value: 'admin-bucket' },
      { key: SETTING_KEYS.storageS3Region, value: 'ap-southeast-1' },
      { key: SETTING_KEYS.storageS3PublicDomain, value: 'https://cdn.example.com' },
      { key: SETTING_KEYS.storageS3EnablePathStyle, value: true },
      { key: SETTING_KEYS.storageS3SetAcl, value: false },
      { key: SETTING_KEYS.storageS3PreviewUrlExpireIn, value: 1800 },
    ]);
  });

  it('allows rotating only the S3 secret without resending the masked current secret', () => {
    const initial = buildFormValues({
      storageS3AccessKeyId: 'env-access-key',
      storageS3Bucket: 'env-bucket',
      storageS3Endpoint: 'https://env-s3.example.com',
      storageS3SecretAccessKeyConfigured: true,
    });

    expect(
      buildSettingUpdates(
        {
          ...initial,
          storageS3SecretAccessKey: 'rotated-secret',
        },
        initial,
      ),
    ).toEqual([{ key: SETTING_KEYS.storageS3SecretAccessKey, value: 'rotated-secret' }]);
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

  it('preserves structured help menu settings for public navigation customization', () => {
    const initial = buildFormValues({
      helpMenuItems: [
        {
          action: 'url',
          enabled: true,
          icon: 'book',
          key: 'docs',
          label: ' Docs ',
          url: ' https://docs.example.com ',
        },
        {
          action: 'feedback',
          enabled: false,
          icon: 'feather',
          key: 'feedback',
          label: 'Hidden feedback',
        },
      ],
    } as any);

    expect(initial.helpMenuItems).toEqual([
      {
        action: 'url',
        enabled: true,
        icon: 'book',
        key: 'docs',
        label: 'Docs',
        url: 'https://docs.example.com',
      },
    ]);

    expect(
      buildSettingUpdates(
        {
          ...initial,
          helpMenuItems: [
            ...initial.helpMenuItems,
            { action: 'changelog', enabled: true, icon: 'file-clock', key: 'updates', label: 'Updates' },
          ],
        },
        initial,
      ),
    ).toEqual([
      {
        key: SETTING_KEYS.helpMenuItems,
        value: [
          ...initial.helpMenuItems,
          { action: 'changelog', enabled: true, icon: 'file-clock', key: 'updates', label: 'Updates' },
        ],
      },
    ]);

    expect(getAdminSettingsRefreshKeys([{ key: SETTING_KEYS.helpMenuItems, value: [] }])).toEqual([
      'public-help-menu',
    ]);
  });

  it('saves about page version settings as one public setting', () => {
    const initial = buildFormValues({
      aboutPage: {
        changelogLabel: 'Changelog',
        changelogUrl: 'https://old.example.com/changelog',
        logoLinkUrl: 'https://old.example.com',
      },
    } as any) as any;

    expect(initial.aboutPage).toEqual({
      changelogLabel: 'Changelog',
      changelogUrl: 'https://old.example.com/changelog',
      logoLinkUrl: 'https://old.example.com',
    });

    expect(getAdminSettingsRefreshKeys([{ key: 'about.page', value: initial.aboutPage }])).toEqual([
      'public-about-page',
    ]);
  });
});
