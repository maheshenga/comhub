import { describe, expect, it } from 'vitest';

import { buildNewapiInstancePayload } from './adminNewapiInstanceForm';

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
      usageScope: [],
    });
  });
});
