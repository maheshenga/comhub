import { describe, expect, it, vi } from 'vitest';

import { runApiActionPlugin } from './apiActionRunner';

describe('runApiActionPlugin', () => {
  it('calls a safe configured API and returns a response-path preview', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"definition":"A fruit."}',
    });

    const result = await runApiActionPlugin({
      action: {
        api: {
          method: 'GET',
          responsePath: 'definition',
          timeoutMs: 30_000,
          url: 'https://api.dictionaryapi.dev/api/v2/entries/en/{word}',
        },
        id: 'dictionary_lookup',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Dictionary Lookup',
        runtimeType: 'api_action',
      },
      fetchImpl,
      input: { word: 'apple' },
      resolveHostname: () => ['93.184.216.34'],
      resolvedSecrets: {},
    });

    expect(result.preview).toBe('A fruit.');
    expect(result.aiActualCredits).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.dictionaryapi.dev/api/v2/entries/en/apple',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('does not leak resolved secrets into the output snapshot', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });

    const result = await runApiActionPlugin({
      action: {
        api: {
          headers: { Authorization: 'Bearer {{API_TOKEN}}' },
          method: 'POST',
          timeoutMs: 30_000,
          url: 'https://example.com/plugin',
        },
        id: 'secured_action',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Secured Action',
        runtimeType: 'api_action',
      },
      fetchImpl,
      input: { query: 'status' },
      resolveHostname: () => ['93.184.216.34'],
      resolvedSecrets: { API_TOKEN: 'secret-token' },
    });

    expect(JSON.stringify(result.outputSnapshot)).not.toContain('secret-token');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/plugin',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    );
  });

  it('does not leak secrets rendered into POST body snapshots', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });

    const result = await runApiActionPlugin({
      action: {
        api: {
          bodyTemplate: { token: '{{API_TOKEN}}', word: '{word}' },
          method: 'POST',
          timeoutMs: 30_000,
          url: 'https://example.com/plugin',
        },
        id: 'secured_action',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Secured Action',
        runtimeType: 'api_action',
      },
      fetchImpl,
      input: { word: 'apple' },
      resolveHostname: () => ['93.184.216.34'],
      resolvedSecrets: { API_TOKEN: 'secret-token' },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/plugin',
      expect.objectContaining({ body: JSON.stringify({ token: 'secret-token', word: 'apple' }) }),
    );
    expect(JSON.stringify(result.outputSnapshot)).not.toContain('secret-token');
  });
});
