import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildNewapiPricingSyncWarnings,
  classifyNewapiModelType,
  fetchNewapiModels,
  fetchNewapiPricing,
  normalizeNewapiSyncRows,
} from './catalog';

describe('NewAPI catalog sync', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('classifies models from supported endpoint metadata first', () => {
    expect(
      classifyNewapiModelType({
        id: 'custom-model',
        supported_endpoint_types: ['chat', 'image_generation'],
      }),
    ).toBe('image');

    expect(
      classifyNewapiModelType({
        id: 'custom-model',
        supported_endpoint_types: ['videos'],
      }),
    ).toBe('video');
  });

  it('classifies models from model id when endpoint metadata is missing', () => {
    expect(classifyNewapiModelType({ id: 'flux-pro-1.1' })).toBe('image');
    expect(classifyNewapiModelType({ id: 'sora-2' })).toBe('video');
    expect(classifyNewapiModelType({ id: 'text-embedding-3-large' })).toBe('embedding');
    expect(classifyNewapiModelType({ id: 'gpt-4o-mini' })).toBe('chat');
  });

  it('normalizes synchronized rows as disabled by default', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [],
      models: [{ id: 'gpt-4o-mini', object: 'model' }],
      pricing: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        enabled: false,
        modelId: 'gpt-4o-mini',
        modelType: 'chat',
      }),
    ]);
  });

  it('preserves enabled state for existing rows', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [
        {
          enabled: true,
          modelId: 'sora-2',
          modelType: 'video',
        },
      ],
      models: [{ id: 'sora-2', object: 'model' }],
      pricing: [],
    });

    expect(rows[0]).toEqual(expect.objectContaining({ enabled: true, modelType: 'video' }));
  });

  it('preserves manual model settings and unrelated metadata during sync', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [
        {
          displayName: 'Manual Display Name',
          enabled: true,
          metadata: {
            customField: 'keep-me',
            manualAbilities: { vision: true },
            manualPricing: { inputRate: 2 },
          },
          modelId: 'gpt-4o',
          modelType: 'chat',
          sortOrder: 9,
        },
      ],
      models: [{ id: 'gpt-4o', object: 'model' }],
      pricing: [{ description: 'Remote Name', model_name: 'gpt-4o', model_ratio: 15 }],
      pricingStatus: 'available',
    });

    expect(rows[0]).toMatchObject({
      displayName: 'Manual Display Name',
      enabled: true,
      metadata: {
        customField: 'keep-me',
        manualAbilities: { vision: true },
        manualPricing: { inputRate: 2 },
        modelRatio: 15,
      },
      sortOrder: 9,
    });
  });

  it('preserves prior pricing metadata when pricing transport is unavailable', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [
        {
          enabled: true,
          metadata: { modelRatio: 12, pricingAvailable: true },
          modelId: 'gpt-4o',
          modelType: 'chat',
        },
      ],
      models: [{ id: 'gpt-4o', object: 'model' }],
      pricing: [],
      pricingStatus: 'unavailable',
    });

    expect(rows[0].metadata).toMatchObject({
      modelRatio: 12,
      pricingAvailable: true,
      pricingSyncStatus: 'unavailable',
    });
  });

  it('deduplicates repeated remote model ids', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [],
      models: [
        { id: 'gpt-4o', object: 'model' },
        { id: 'gpt-4o', object: 'model' },
      ],
      pricing: [],
      pricingStatus: 'available',
    });

    expect(rows).toHaveLength(1);
  });

  it('disables previously synchronized models that disappear upstream', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [
        {
          displayName: 'Legacy Model',
          enabled: true,
          metadata: { customField: 'keep-me', syncSource: 'newapi' },
          modelId: 'legacy-model',
          modelType: 'chat',
          sortOrder: 4,
        },
      ],
      models: [],
      pricing: [],
      pricingStatus: 'available',
    });

    expect(rows).toEqual([
      expect.objectContaining({
        displayName: 'Legacy Model',
        enabled: false,
        metadata: expect.objectContaining({
          customField: 'keep-me',
          syncSource: 'newapi',
          syncStatus: 'stale',
        }),
        modelId: 'legacy-model',
        sortOrder: 4,
      }),
    ]);
  });

  it('preserves upstream group and pricing metadata during sync', () => {
    const rows = normalizeNewapiSyncRows({
      existingRows: [],
      models: [{ id: 'gpt-4o', object: 'model' }],
      pricing: [
        {
          completion_ratio: 3,
          description: 'GPT 4o Pro',
          enable_groups: ['pro', 'vip'],
          model_name: 'gpt-4o',
          model_ratio: 15,
          quota_type: 0,
          supported_endpoint_types: ['chat_completions'],
        },
      ],
    });

    expect(rows[0].metadata).toMatchObject({
      completionRatio: 3,
      enableGroups: ['pro', 'vip'],
      modelRatio: 15,
      pricingAvailable: true,
      quotaType: 0,
      supportedEndpointTypes: ['chat_completions'],
    });
  });

  it('distinguishes unavailable pricing responses from valid empty pricing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        ok: true,
        text: async () => '<!doctype html><html></html>',
      }),
    );

    await expect(
      fetchNewapiPricing({
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example.com/v1',
      }),
    ).resolves.toEqual(expect.objectContaining({ items: [], status: 'unavailable' }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: new Headers({ 'content-type': 'application/json' }),
        ok: true,
        text: async () => JSON.stringify({ data: [], success: true }),
      }),
    );

    await expect(
      fetchNewapiPricing({
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example.com/v1',
      }),
    ).resolves.toEqual({ items: [], status: 'available' });
  });

  it('returns no pricing without calling pricing endpoint for non-NewAPI providers', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchNewapiPricing({
        apiKey: 'sk-test',
        baseUrl: 'https://siliconflow.example.com/v1',
        providerType: 'siliconflow',
      }),
    ).resolves.toEqual({ items: [], status: 'unsupported' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports unsupported pricing sync for non-NewAPI providers', () => {
    expect(buildNewapiPricingSyncWarnings('siliconflow', 0)).toEqual([
      'Pricing sync is not supported for provider type siliconflow. Configure manual pricing in the model billing matrix.',
    ]);
  });

  it('keeps the NewAPI empty pricing endpoint warning', () => {
    expect(buildNewapiPricingSyncWarnings('newapi', 0, 'available')).toEqual([
      'Pricing endpoint returned no entries',
    ]);
  });

  it('reports pricing transport failures without treating them as an empty catalog', () => {
    expect(buildNewapiPricingSyncWarnings('newapi', 0, 'unavailable')).toEqual([
      'Pricing endpoint unavailable; existing pricing metadata was preserved',
    ]);
  });

  it('does not duplicate the v1 segment when fetching models', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [] }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchNewapiModels({
      apiKey: 'sk-test',
      baseUrl: 'https://newapi.example.com/v1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://newapi.example.com/v1/models',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer sk-test',
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('uses Anthropic headers when fetching Claude-format models', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [] }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchNewapiModels({
      apiKey: 'sk-claude',
      baseUrl: 'https://api.anthropic.com',
      providerType: 'claude',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({
        headers: {
          'Accept': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': 'sk-claude',
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('reports a clear error when the models endpoint returns html', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        ok: true,
        text: async () => '<!doctype html><html></html>',
      }),
    );

    await expect(
      fetchNewapiModels({
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example.com/v1',
      }),
    ).rejects.toThrow(
      'AI provider models endpoint did not return JSON. Check that the base URL is an API endpoint.',
    );
  });

  it('rejects model responses that exceed the configured body limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: new Headers({ 'content-type': 'application/json' }),
        ok: true,
        text: async () => JSON.stringify({ data: [{ id: 'gpt-4o' }] }),
      }),
    );

    await expect(
      fetchNewapiModels({
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example.com/v1',
        maxBodyBytes: 8,
      }),
    ).rejects.toThrow('AI provider models response exceeded the 8 byte limit');
  });

  it('reads response streams through the bounded body path', async () => {
    const releaseLock = vi.fn();
    const text = vi.fn().mockRejectedValue(new Error('unbounded text read'));
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode(JSON.stringify({ data: [{ id: 'gpt-4o' }] })),
      })
      .mockResolvedValueOnce({ done: true, value: undefined });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        body: { getReader: () => ({ cancel: vi.fn(), read, releaseLock }) },
        headers: new Headers({ 'content-type': 'application/json' }),
        ok: true,
        text,
      }),
    );

    await expect(
      fetchNewapiModels({
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example.com/v1',
      }),
    ).resolves.toEqual([{ id: 'gpt-4o' }]);
    expect(text).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it('keeps the request timeout active while reading the response body', async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => ({
        headers: new Headers({ 'content-type': 'application/json' }),
        ok: true,
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted', 'AbortError')),
              { once: true },
            );
          }),
      })),
    );

    const request = fetchNewapiModels({
      apiKey: 'sk-test',
      baseUrl: 'https://newapi.example.com/v1',
      timeoutMs: 10,
    });
    const outcome = Promise.race([
      request.then(
        () => ({ status: 'resolved' as const }),
        (error: Error) => ({ error, status: 'rejected' as const }),
      ),
      new Promise<{ status: 'pending' }>((resolve) =>
        setTimeout(() => resolve({ status: 'pending' }), 50),
      ),
    ]);

    await vi.advanceTimersByTimeAsync(50);

    await expect(outcome).resolves.toMatchObject({
      error: new Error('AI provider models request timed out after 10ms'),
      status: 'rejected',
    });
  });
});
