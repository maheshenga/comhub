// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerate = vi.hoisted(() => vi.fn((input) => input));
const mockGetServerBrand = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/business-const', () => ({
  BRANDING_LOGO_URL: '',
  BRANDING_NAME: 'LobeHub',
}));

vi.mock('es-toolkit/compat', () => ({
  kebabCase: (value: string) => value.toLowerCase().replaceAll(/\s+/g, '-'),
}));

vi.mock('@/server/manifest', () => ({
  manifestModule: {
    generate: mockGenerate,
  },
}));

vi.mock('@/server/services/brand', () => ({
  getServerBrand: mockGetServerBrand,
}));

describe('app manifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerBrand.mockResolvedValue({
      faviconUrl: 'https://cdn.example.com/favicon.ico',
      logoUrl: 'https://cdn.example.com/logo.png',
      name: 'Xuangguo AI',
    });
  });

  it('uses the public brand name and logo for installable app metadata', async () => {
    const manifest = (await import('./manifest')).default;
    const result = await manifest();

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        icons: expect.arrayContaining([
          expect.objectContaining({
            url: 'https://cdn.example.com/logo.png',
          }),
        ]),
        id: 'xuangguo-ai',
        name: 'Xuangguo AI',
      }),
    );
    expect(result.name).toBe('Xuangguo AI');
  });
});
