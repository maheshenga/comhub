import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  classifyNewapiModelType,
  fetchNewapiModels,
  fetchNewapiPricing,
  normalizeNewapiSyncRows,
} from './catalog';

describe('NewAPI catalog sync', () => {
  afterEach(() => {
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

  it('treats non-json pricing responses as unavailable', async () => {
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
    ).resolves.toEqual([]);
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

    expect(fetchMock).toHaveBeenCalledWith('https://newapi.example.com/v1/models', {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer sk-test',
      },
    });
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

    expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/models', {
      headers: {
        Accept: 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'sk-claude',
      },
    });
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
    ).rejects.toThrow('模型列表接口返回的不是 JSON');
  });
});
