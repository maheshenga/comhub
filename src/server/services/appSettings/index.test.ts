import { beforeEach, describe, expect, it } from 'vitest';

import {
  getServerDefaultModelSuggestions,
  invalidateServerAppSettings,
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
});
