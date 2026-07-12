import { describe, expect, it, vi } from 'vitest';
import type { ModuleAppActionConfig } from '@lobechat/types';

import { runModuleAppApiAction } from './apiActionRunner';

const action: ModuleAppActionConfig = {
  id: 'lookup',
  inputSchema: { fields: [] },
  moduleMultiplier: 1,
  name: 'Lookup',
  outputSchema: {},
  runtimeConfig: {
    bodyTemplate: { keyword: '{{keyword}}', token: '{{apiKey}}' },
    headers: { Authorization: 'Bearer {{apiKey}}' },
    method: 'POST',
    responsePath: 'data.summary',
    url: 'https://api.example.com/search',
  },
  runtimeType: 'api_action',
};

describe('runModuleAppApiAction', () => {
  it('runs a templated API request and redacts secret values from snapshots', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      headers: { get: () => 'application/json' },
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { summary: 'fruit' } }),
    });

    const result = await runModuleAppApiAction({
      action,
      fetchImpl,
      input: { keyword: 'apple' },
      resolvedSecrets: { apiKey: 'secret-token' },
      resolveHostname: () => ['93.184.216.34'],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/search',
      expect.objectContaining({
        body: JSON.stringify({ keyword: 'apple', token: 'secret-token' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      }),
    );
    expect(result).toMatchObject({
      actualAiCredits: 0,
      artifacts: [],
      preview: 'fruit',
    });
    expect(result.output).toMatchObject({
      request: {
        body: JSON.stringify({ keyword: 'apple', token: '[REDACTED]' }),
        headers: { Authorization: '[REDACTED]', 'Content-Type': 'application/json' },
        method: 'POST',
        url: 'https://api.example.com/search',
      },
      response: {
        body: { data: { summary: 'fruit' } },
        status: 200,
      },
    });
  });

  it('rejects missing API URLs', async () => {
    await expect(
      runModuleAppApiAction({
        action: { ...action, runtimeConfig: {}, runtimeType: 'api_action' },
        fetchImpl: vi.fn(),
        input: {},
        resolveHostname: () => ['93.184.216.34'],
      }),
    ).rejects.toThrow('MODULE_APP_API_ACTION_NOT_CONFIGURED');
  });
});
