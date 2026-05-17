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
    authTitle: 'Default auth title',
    copyrightText: '2026 Default. All rights reserved.',
    loadingText: 'Loading',
    logoUrl: '/images/brand/qingyou-ai-logo.png',
    name: 'Default Brand',
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
        'brand.authTitle': 'Welcome to Acme',
        'brand.copyrightText': '2026 Acme',
        'defaultSkill.name': 'Acme Skill',
        'brand.faviconUrl': 'https://x/favicon.ico',
        'brand.loadingText': 'Loading Acme',
        'brand.logoUrl': 'https://x/logo.svg',
        'brand.name': 'Acme',
        'brand.primaryColor': '#ff00aa',
        'brand.slogan': 'Better than ever',
      };
      return map[k] ? { value: map[k] } : null;
    });

    const out = await getServerBrand();
    expect(out).toEqual({
      authTitle: 'Welcome to Acme',
      copyrightText: '2026 Acme',
      defaultSkillName: 'Acme Skill',
      faviconUrl: 'https://x/favicon.ico',
      loadingText: 'Loading Acme',
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
      authTitle: 'Default auth title',
      copyrightText: '2026 Default. All rights reserved.',
      defaultSkillName: 'Default Brand',
      faviconUrl: null,
      loadingText: 'Loading',
      logoUrl: '/images/brand/qingyou-ai-logo.png',
      name: 'Default Brand',
      primaryColor: '#12b981',
      slogan: 'Default auth title',
    });
  });

  it('caches the result for the configured TTL', async () => {
    findFirstMock.mockResolvedValue({ value: 'CachedName' });
    await getServerBrand();
    await getServerBrand();
    await getServerBrand();
    // Each call queries 9 keys; only the first call should hit the DB.
    expect(findFirstMock).toHaveBeenCalledTimes(9);
  });

  it('invalidate forces a fresh fetch', async () => {
    findFirstMock.mockResolvedValue({ value: 'CachedName' });
    await getServerBrand();
    invalidateServerBrand();
    await getServerBrand();
    expect(findFirstMock).toHaveBeenCalledTimes(18);
  });

  it('falls back to the default runtime brand on database errors', async () => {
    findFirstMock.mockRejectedValue(new Error('boom'));
    const out = await getServerBrand();
    expect(out).toEqual({
      authTitle: 'Default auth title',
      copyrightText: '2026 Default. All rights reserved.',
      defaultSkillName: 'Default Brand',
      faviconUrl: null,
      loadingText: 'Loading',
      logoUrl: '/images/brand/qingyou-ai-logo.png',
      name: 'Default Brand',
      primaryColor: '#12b981',
      slogan: 'Default auth title',
    });
  });
});
