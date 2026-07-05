import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';

import {
  APP_SETTING_KEYS,
  getAppSettingRegistryItem,
  getServerComposioConfig,
  getServerDefaultAgentSettingOverrides,
  getServerDefaultModelSuggestions,
  getServerFileS3Config,
  invalidateServerAppSettings,
  isSensitiveAppSettingKey,
  normalizeModelIdList,
  serializeModelIdList,
} from './index';

describe('appSettings model helpers', () => {
  beforeEach(() => {
    invalidateServerAppSettings();
  });

  it('normalizes and dedupes model IDs from mixed separators', () => {
    expect(normalizeModelIdList('gpt-4o-mini\n gpt-4.1 ;gpt-4o-mini，claude-3.7-sonnet')).toEqual([
      'gpt-4o-mini',
      'gpt-4.1',
      'claude-3.7-sonnet',
    ]);
    expect(serializeModelIdList(['gpt-4o-mini', 'gpt-4.1', 'gpt-4o-mini'])).toBe(
      'gpt-4o-mini\ngpt-4.1',
    );
  });

  it('exposes shared setting registry metadata', () => {
    expect(APP_SETTING_KEYS.brandName).toBe('brand.name');
    expect(getAppSettingRegistryItem(APP_SETTING_KEYS.brandName)).toMatchObject({
      domain: 'brand',
      publicRuntime: true,
    });
  });

  it('marks sensitive setting keys', () => {
    expect(isSensitiveAppSettingKey(APP_SETTING_KEYS.composioApiKey)).toBe(true);
    expect(isSensitiveAppSettingKey(APP_SETTING_KEYS.brandName)).toBe(false);
  });

  it('returns the current model as a default model suggestion', async () => {
    const result = await getServerDefaultModelSuggestions({
      currentModel: 'claude-3.7-sonnet',
    });

    expect(result).toEqual(['claude-3.7-sonnet']);
  });

  it('returns an empty list when the current model is not set', async () => {
    const result = await getServerDefaultModelSuggestions({
      currentModel: '',
    });

    expect(result).toEqual([]);
  });

  it('returns default assistant identity overrides from app settings', async () => {
    const db = {
      query: {
        appSettings: {
          findMany: async () => [
            { key: APP_SETTING_KEYS.defaultAgentModel, value: 'deepseek-chat' },
            { key: APP_SETTING_KEYS.defaultAgentProvider, value: 'newapi' },
            { key: APP_SETTING_KEYS.defaultAgentName, value: DEFAULT_COMHUB_AGENT_NAME },
            { key: APP_SETTING_KEYS.defaultAgentAvatar, value: '/images/brand/logo.svg' },
          ],
        },
      },
    } as any;

    await expect(getServerDefaultAgentSettingOverrides(db)).resolves.toEqual({
      avatar: '/images/brand/logo.svg',
      model: 'deepseek-chat',
      provider: 'newapi',
      title: DEFAULT_COMHUB_AGENT_NAME,
    });
  });

  it('resolves S3 file storage config from admin settings before environment fallback', async () => {
    const db = {
      query: {
        appSettings: {
          findMany: async () => [
            { key: APP_SETTING_KEYS.storageS3AccessKeyId, value: 'admin-access-key' },
            { key: APP_SETTING_KEYS.storageS3SecretAccessKey, value: 'admin-secret-key' },
            { key: APP_SETTING_KEYS.storageS3Endpoint, value: 'https://admin-s3.example.com' },
            { key: APP_SETTING_KEYS.storageS3Bucket, value: 'admin-bucket' },
            { key: APP_SETTING_KEYS.storageS3Region, value: 'ap-southeast-1' },
            { key: APP_SETTING_KEYS.storageS3PublicDomain, value: 'https://cdn.example.com' },
            { key: APP_SETTING_KEYS.storageS3FilePath, value: '/admin-files/' },
            { key: APP_SETTING_KEYS.storageS3EnablePathStyle, value: true },
            { key: APP_SETTING_KEYS.storageS3SetAcl, value: false },
            { key: APP_SETTING_KEYS.storageS3PreviewUrlExpireIn, value: 1800 },
          ],
        },
      },
    } as any;

    await expect(getServerFileS3Config(db)).resolves.toEqual({
      accessKeyId: 'admin-access-key',
      bucket: 'admin-bucket',
      enablePathStyle: true,
      endpoint: 'https://admin-s3.example.com',
      filePath: 'admin-files',
      previewUrlExpireIn: 1800,
      publicDomain: 'https://cdn.example.com',
      region: 'ap-southeast-1',
      secretAccessKey: 'admin-secret-key',
      setAcl: false,
    });
  });

  it('returns Composio config from app settings with env fallback', async () => {
    const db = {
      query: {
        appSettings: {
          findMany: async () => [
            { key: APP_SETTING_KEYS.composioEnabled, value: true },
            { key: APP_SETTING_KEYS.composioApiKey, value: 'ak_admin' },
            { key: APP_SETTING_KEYS.composioAuthConfigIds, value: '{"gmail":"ac_admin"}' },
          ],
        },
      },
    } as any;

    await expect(getServerComposioConfig(db)).resolves.toEqual({
      apiKey: 'ak_admin',
      authConfigIds: '{"gmail":"ac_admin"}',
      enabled: true,
    });
  });

  it('does not share cached app settings between explicit database instances', async () => {
    const createDb = (model: string) =>
      ({
        query: {
          appSettings: {
            findMany: async () => [{ key: APP_SETTING_KEYS.defaultAgentModel, value: model }],
          },
        },
      }) as any;

    await expect(getServerDefaultAgentSettingOverrides(createDb('first-model'))).resolves.toEqual({
      model: 'first-model',
    });
    await expect(getServerDefaultAgentSettingOverrides(createDb('second-model'))).resolves.toEqual({
      model: 'second-model',
    });
  });
});
