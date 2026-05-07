import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerBrand, invalidateServerBrand } from '../index';

const findFirstMock = vi.fn();
vi.mock('@/database/server', () => ({
  getServerDB: vi.fn(async () => ({
    query: { appSettings: { findFirst: findFirstMock } },
  })),
}));
vi.mock('@/database/schemas', () => ({
  appSettings: { key: 'app_settings.key' },
}));
vi.mock('@/const/brand', () => ({
  DEFAULT_RUNTIME_BRAND: {
    logoUrl: '/images/brand/qingyou-ai-logo.png',
    name: '青柚AI',
    primaryColor: '#12b981',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
}));

describe('getServerBrand', () => {
  beforeEach(() => {
    invalidateServerBrand();
    findFirstMock.mockReset();
  });
  afterEach(() => {
    invalidateServerBrand();
  });

  it('returns the configured brand keys when present', async () => {
    findFirstMock.mockImplementation(async (args: any) => {
      const k = args.where.b;
      const map: Record<string, string> = {
        'brand.faviconUrl': 'https://x/favicon.ico',
        'brand.logoUrl': 'https://x/logo.svg',
        'brand.name': 'Acme',
        'brand.primaryColor': '#ff00aa',
        'brand.slogan': 'Better than ever',
      };
      return map[k] ? { value: map[k] } : null;
    });

    const out = await getServerBrand();
    expect(out).toEqual({
      faviconUrl: 'https://x/favicon.ico',
      logoUrl: 'https://x/logo.svg',
      name: 'Acme',
      primaryColor: '#ff00aa',
      slogan: 'Better than ever',
    });
  });

  it('uses the default runtime brand when keys are missing', async () => {
    findFirstMock.mockResolvedValue(null);
    const out = await getServerBrand();
    expect(out).toEqual({
      faviconUrl: null,
      logoUrl: '/images/brand/qingyou-ai-logo.png',
      name: '青柚AI',
      primaryColor: '#12b981',
      slogan: null,
    });
  });

  it('caches the result for the configured TTL', async () => {
    findFirstMock.mockResolvedValue({ value: 'CachedName' });
    await getServerBrand();
    await getServerBrand();
    await getServerBrand();
    // Each call queries 5 keys; only the first call should hit the DB.
    expect(findFirstMock).toHaveBeenCalledTimes(5);
  });

  it('invalidate forces a fresh fetch', async () => {
    findFirstMock.mockResolvedValue({ value: 'CachedName' });
    await getServerBrand();
    invalidateServerBrand();
    await getServerBrand();
    expect(findFirstMock).toHaveBeenCalledTimes(10);
  });

  it('falls back to the default runtime brand on database errors', async () => {
    findFirstMock.mockRejectedValue(new Error('boom'));
    const out = await getServerBrand();
    expect(out).toEqual({
      faviconUrl: null,
      logoUrl: '/images/brand/qingyou-ai-logo.png',
      name: '青柚AI',
      primaryColor: '#12b981',
      slogan: null,
    });
  });
});
