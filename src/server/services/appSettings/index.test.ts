import { beforeEach, describe, expect, it } from 'vitest';

import {
  APP_SETTING_KEYS,
  getServerManagedDefaultModelSuggestions,
  getServerManagedNewApiModelIds,
  invalidateServerAppSettings,
  normalizeModelIdList,
  serializeModelIdList,
} from './index';

const createMockDb = (values: Record<string, unknown>) =>
  ({
    query: {
      appSettings: {
        findFirst: async ({ where }: any) => {
          const key = where?.right?.value;
          if (!key || !(key in values)) return undefined;

          return { key, value: values[key] };
        },
        findMany: async () =>
          Object.entries(values).map(([key, value]) => ({
            key,
            value,
          })),
      },
    },
  }) as any;

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

  it('reads the global newapi model list from app settings', async () => {
    const db = createMockDb({
      [APP_SETTING_KEYS.newapiEnabledModels]: 'gpt-4.1\ngpt-4o-mini\ntext-embedding-3-large',
    });

    const result = await getServerManagedNewApiModelIds(db);

    expect(result).toEqual(['gpt-4.1', 'gpt-4o-mini', 'text-embedding-3-large']);
  });

  it('keeps the current model first and appends the global model list', async () => {
    const db = createMockDb({
      [APP_SETTING_KEYS.newapiEnabledModels]: 'gpt-4.1\ngpt-4o-mini',
    });

    const result = await getServerManagedDefaultModelSuggestions({
      currentModel: 'claude-3.7-sonnet',
      db,
    });

    expect(result).toEqual(['claude-3.7-sonnet', 'gpt-4.1', 'gpt-4o-mini']);
  });

  it('dedupes the current model when it already exists in the global model list', async () => {
    const db = createMockDb({
      [APP_SETTING_KEYS.newapiEnabledModels]: 'gpt-4o-mini\ngpt-4o',
    });

    const result = await getServerManagedDefaultModelSuggestions({
      currentModel: 'gpt-4o-mini',
      db,
    });

    expect(result).toEqual(['gpt-4o-mini', 'gpt-4o']);
  });

  it('returns an empty list when neither the current model nor the global model list is set', async () => {
    const db = createMockDb({});

    const result = await getServerManagedDefaultModelSuggestions({
      currentModel: '',
      db,
    });

    expect(result).toEqual([]);
  });
});
