import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADMIN_MODEL_DEFAULTS_SETTING_KEY,
  clearAdminModelDefaultsCache,
  loadAdminModelDefaults,
  modelDefaultsKey,
} from './index';

const createDb = (value?: unknown) => {
  const findFirst = vi.fn().mockResolvedValue(value === undefined ? undefined : { value });

  return {
    db: { query: { appSettings: { findFirst } } } as any,
    findFirst,
  };
};

const createFailingDb = () => {
  const findFirst = vi.fn().mockRejectedValue(new Error('app_settings unavailable'));

  return {
    db: { query: { appSettings: { findFirst } } } as any,
    findFirst,
  };
};

describe('loadAdminModelDefaults', () => {
  beforeEach(() => {
    clearAdminModelDefaultsCache();
  });

  afterEach(() => {
    clearAdminModelDefaultsCache();
    vi.useRealTimers();
  });

  it('reads the model.defaults app setting and resolves keyed lookups', async () => {
    const { db, findFirst } = createDb({
      contextWindow: [{ modelId: 'gpt-5', providerId: 'instance-1', tokens: 128_000 }],
      reasoning: [
        { config: { gpt5ReasoningEffort: 'high' }, modelId: 'gpt-5', providerId: 'instance-1' },
      ],
    });

    const result = await loadAdminModelDefaults(db);
    const key = modelDefaultsKey('instance-1', 'gpt-5');
    const where = findFirst.mock.calls[0]?.[0]?.where;

    expect(ADMIN_MODEL_DEFAULTS_SETTING_KEY).toBe('model.defaults');
    expect(new PgDialect().sqlToQuery(where).params).toEqual(['model.defaults']);
    expect(result.contextWindow.get(key)).toBe(128_000);
    expect(result.reasoning.get(key)).toEqual({ gpt5ReasoningEffort: 'high' });
    expect(result.reasoningRecord[key]).toEqual({ gpt5ReasoningEffort: 'high' });
    expect(result.raw.contextWindow).toEqual([
      { modelId: 'gpt-5', providerId: 'instance-1', tokens: 128_000 },
    ]);
  });

  it('uses a 30s module-level cache until cleared or expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const { db, findFirst } = createDb({ contextWindow: [], reasoning: [] });

    await loadAdminModelDefaults(db);
    await loadAdminModelDefaults(db);
    expect(findFirst).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-01-01T00:00:30.001Z'));
    await loadAdminModelDefaults(db);
    expect(findFirst).toHaveBeenCalledTimes(2);

    clearAdminModelDefaultsCache();
    await loadAdminModelDefaults(db);
    expect(findFirst).toHaveBeenCalledTimes(3);
  });

  it('returns an empty resolved config when the row is missing', async () => {
    const { db } = createDb();

    const result = await loadAdminModelDefaults(db);

    expect(result.contextWindow.size).toBe(0);
    expect(result.reasoning.size).toBe(0);
    expect(result.reasoningRecord).toEqual({});
    expect(result.raw).toEqual({ contextWindow: [], reasoning: [] });
  });

  it('degrades to empty defaults without caching when the read fails', async () => {
    const { db, findFirst } = createFailingDb();

    const result = await loadAdminModelDefaults(db);

    expect(result.contextWindow.size).toBe(0);
    expect(findFirst).toHaveBeenCalledTimes(1);

    await loadAdminModelDefaults(db);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});
