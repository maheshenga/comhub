import { describe, expect, it, vi } from 'vitest';

import { createPlatformPluginService } from './platformPlugin';

describe('platformPluginService', () => {
  it('uses lambda.platformPlugin router names', async () => {
    const client = {
      platformPlugin: {
        listMarketplace: { query: vi.fn().mockResolvedValue([{ id: 'p1' }]) },
      },
    };
    const service = createPlatformPluginService(client as never);

    await expect(
      service.listMarketplace({ query: 'research', runtimeType: 'content_generation' }),
    ).resolves.toEqual([{ id: 'p1' }]);
    expect(client.platformPlugin.listMarketplace.query).toHaveBeenCalledWith({
      query: 'research',
      runtimeType: 'content_generation',
    });
  });

  it('passes install and run inputs to lambda.platformPlugin mutations', async () => {
    const client = {
      platformPlugin: {
        install: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
        run: { mutate: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'succeeded' }) },
      },
    };
    const service = createPlatformPluginService(client as never);
    const pluginId = '00000000-0000-4000-8000-000000000001';

    await expect(service.install({ pluginId })).resolves.toEqual({ ok: true });
    await expect(
      service.run({
        actionId: 'dictionary_lookup',
        agentId: 'agt_001',
        input: { word: 'apple' },
        pluginId,
      }),
    ).resolves.toMatchObject({ runId: 'run-1' });
    expect(client.platformPlugin.install.mutate).toHaveBeenCalledWith({ pluginId });
    expect(client.platformPlugin.run.mutate).toHaveBeenCalledWith({
      actionId: 'dictionary_lookup',
      agentId: 'agt_001',
      input: { word: 'apple' },
      pluginId,
    });
  });
});
