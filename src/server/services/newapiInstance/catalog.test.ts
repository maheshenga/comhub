import { describe, expect, it } from 'vitest';

import { classifyNewapiModelType, normalizeNewapiSyncRows } from './catalog';

describe('NewAPI catalog sync', () => {
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
});
