import { describe, expect, it } from 'vitest';

import {
  buildNewapiInstancePayload,
  getDefaultBaseUrlForAdminProviderType,
} from './adminNewapiInstanceForm';

describe('buildNewapiInstancePayload', () => {
  it('should serialize newapi group fields for create payloads', () => {
    expect(
      buildNewapiInstancePayload({
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example.com',
        description: '',
        enabled: true,
        fetchOnClient: false,
        groupKey: ' pro ',
        groupMultiplier: 1.25,
        groupName: 'Pro Group',
        name: 'NewAPI Pro',
        priority: 10,
        providerType: 'newapi',
        usageScope: ['chat', 'image'],
      }),
    ).toEqual({
      apiKey: 'sk-test',
      baseUrl: 'https://newapi.example.com',
      enabled: true,
      fetchOnClient: false,
      groupKey: 'pro',
      groupMultiplier: 1.25,
      groupName: 'Pro Group',
      name: 'NewAPI Pro',
      priority: 10,
      providerType: 'newapi',
      usageScope: ['chat', 'image'],
    });
  });

  it('should omit masked api keys for update payloads', () => {
    expect(
      buildNewapiInstancePayload(
        {
          apiKey: 'sk-****test',
          baseUrl: 'https://newapi.example.com',
          description: 'primary',
          enabled: false,
          fetchOnClient: true,
          groupKey: '',
          groupMultiplier: undefined,
          groupName: '',
          name: 'NewAPI Default',
          priority: undefined,
          providerType: 'deepseek',
          usageScope: [],
        },
        { isEdit: true },
      ),
    ).toEqual({
      baseUrl: 'https://newapi.example.com',
      description: 'primary',
      enabled: false,
      fetchOnClient: true,
      groupKey: 'default',
      name: 'NewAPI Default',
      priority: 0,
      providerType: 'deepseek',
      usageScope: [],
    });
  });

  it('should omit empty group multiplier from update payloads', () => {
    expect(
      buildNewapiInstancePayload(
        {
          apiKey: 'sk-****test',
          baseUrl: 'https://newapi.example.com',
          enabled: true,
          groupKey: 'default',
          groupMultiplier: null as any,
          name: 'NewAPI Default',
        },
        { isEdit: true },
      ),
    ).toEqual({
      baseUrl: 'https://newapi.example.com',
      enabled: true,
      fetchOnClient: false,
      groupKey: 'default',
      name: 'NewAPI Default',
      priority: 0,
      providerType: 'newapi',
      usageScope: [],
    });
  });

  it('should default provider type to newapi for legacy form values', () => {
    expect(
      buildNewapiInstancePayload({
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example.com',
        enabled: true,
        name: 'Legacy Instance',
      }),
    ).toEqual(
      expect.objectContaining({
        providerType: 'newapi',
      }),
    );
  });

  it('should expose default base urls for provider presets', () => {
    expect(getDefaultBaseUrlForAdminProviderType('openai')).toBe('https://api.openai.com/v1');
    expect(getDefaultBaseUrlForAdminProviderType('deepseek')).toBe('https://api.deepseek.com/v1');
    expect(getDefaultBaseUrlForAdminProviderType('aliyun')).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    );
    expect(getDefaultBaseUrlForAdminProviderType('openai-compatible')).toBeUndefined();
  });
});
