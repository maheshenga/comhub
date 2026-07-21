import { describe, expect, it } from 'vitest';

import { DEFAULT_MOBILE_CONFIG, normalizeMobileConfig } from '@/const/mobileConfig';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import {
  buildDesktopSettings,
  buildMobileSettings,
  buildSystemDefaultsSettings,
} from './adminReadModel';
import { AppSettingsSnapshot } from './loader';

describe('system defaults admin read model', () => {
  it('preserves persisted user global defaults instead of returning an empty baseline', async () => {
    const storedDefaults = {
      general: { themeMode: 'dark' },
      systemAgent: { inputCompletion: { enabled: true } },
    };
    const snapshot = new AppSettingsSnapshot(
      [APP_SETTING_KEYS.userGlobalSettingsDefaults],
      [{ key: APP_SETTING_KEYS.userGlobalSettingsDefaults, value: storedDefaults }],
    );

    const result = await buildSystemDefaultsSettings(snapshot);

    expect(result.userGlobalSettingsDefaults).toEqual(storedDefaults);
    expect(result.userGlobalSettingsDefaults).not.toEqual({});
  });
});

describe('mobile admin read model', () => {
  const mobileSnapshot = (value?: unknown) =>
    new AppSettingsSnapshot(
      [APP_SETTING_KEYS.mobileConfig],
      value === undefined ? [] : [{ key: APP_SETTING_KEYS.mobileConfig, value }],
    );

  it('returns safe defaults when the mobile setting is missing', () => {
    expect(buildMobileSettings(mobileSnapshot())).toEqual(DEFAULT_MOBILE_CONFIG);
  });

  it('returns safe defaults for an unsupported mobile config version', () => {
    expect(buildMobileSettings(mobileSnapshot({ version: 2 }))).toEqual(DEFAULT_MOBILE_CONFIG);
  });

  it('repairs unsafe navigation routes while retaining the valid version 1 config', () => {
    const rawConfig = {
      brand: { displayName: 'ComHub' },
      navigation: {
        items: [
          {
            icon: 'bell',
            id: 'slot-1',
            label: 'Inbox',
            order: 1,
            path: 'javascript:alert(1)',
            visible: true,
          },
        ],
      },
      version: 1,
    };

    const result = buildMobileSettings(mobileSnapshot(rawConfig));

    expect(result).toEqual(normalizeMobileConfig(rawConfig));
    expect(result.brand.displayName).toBe('ComHub');
    expect(result.navigation.items.find((item) => item.id === 'slot-1')?.path).toBe('/');
  });

  it('limits persisted featured assistants to four', () => {
    const rawConfig = {
      discover: {
        assistants: Array.from({ length: 5 }, (_, index) => ({
          assistantId: `assistant-${index}`,
          model: 'chat-model',
          order: index + 1,
          provider: 'catalog',
        })),
      },
      version: 1,
    };

    expect(buildMobileSettings(mobileSnapshot(rawConfig)).discover.assistants).toHaveLength(4);
  });
});

describe('desktop admin read model', () => {
  it('returns OSS metadata without credential material', () => {
    const snapshot = new AppSettingsSnapshot(
      [
        APP_SETTING_KEYS.desktopOssAccessKeyId,
        APP_SETTING_KEYS.desktopOssAccessKeySecret,
        APP_SETTING_KEYS.desktopOssBucket,
        APP_SETTING_KEYS.desktopOssEndpoint,
        APP_SETTING_KEYS.desktopOssPath,
      ],
      [
        { key: APP_SETTING_KEYS.desktopOssAccessKeyId, value: 'access-key-id' },
        { key: APP_SETTING_KEYS.desktopOssAccessKeySecret, value: 'access-key-secret' },
        { key: APP_SETTING_KEYS.desktopOssBucket, value: 'releases' },
        { key: APP_SETTING_KEYS.desktopOssEndpoint, value: 'oss.example.com' },
        { key: APP_SETTING_KEYS.desktopOssPath, value: 'desktop' },
      ],
    );

    const result = buildDesktopSettings(snapshot);

    expect(result.desktopOssConfig).toEqual({
      bucket: 'releases',
      credentialsConfigured: true,
      endpoint: 'oss.example.com',
      path: 'desktop',
    });
    expect(result.desktopOssConfig).not.toHaveProperty('accessKeyId');
    expect(result.desktopOssConfig).not.toHaveProperty('accessKeySecretMasked');
    expect(JSON.stringify(result)).not.toContain('access-key-id');
    expect(JSON.stringify(result)).not.toContain('access-key-secret');
  });

  it('removes unsafe legacy download URLs from browser-facing settings', () => {
    const snapshot = new AppSettingsSnapshot(
      [APP_SETTING_KEYS.desktopDownloadUrl],
      [{ key: APP_SETTING_KEYS.desktopDownloadUrl, value: 'javascript:alert(1)' }],
    );

    expect(buildDesktopSettings(snapshot).desktopDownloadUrl).toBeNull();
  });
});
