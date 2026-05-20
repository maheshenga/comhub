// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

const mockGetServerBrand = vi.hoisted(() => vi.fn());

vi.mock('@/server/services/brand', () => ({
  getServerBrand: mockGetServerBrand,
}));

vi.mock('@/server/translation', () => ({
  translation: vi.fn(async () => ({
    t: (key: string, vars?: { appName?: string }) => {
      if (key === 'signin.subtitle') return `${vars?.appName} 登录说明`;
      if (key === 'betterAuth.signin.emailStep.title') return '登录';
      return key;
    },
  })),
}));

vi.mock('@/utils/server/routeVariants', () => ({
  RouteVariants: {
    getLocale: vi.fn(async () => 'zh-CN'),
  },
}));

vi.mock('./SignInPageClient', () => ({
  default: () => null,
}));

describe('signin metadata', () => {
  it('sets a signin title and runtime brand description', async () => {
    mockGetServerBrand.mockResolvedValue({
      authTitle: '后台登录标题',
      faviconUrl: null,
      name: '玄果AI',
    });

    const { generateMetadata } = await import('./page');
    const metadata = await generateMetadata({} as any);

    expect(metadata.title).toBe('登录');
    expect(metadata.description).toBe('玄果AI 登录说明');
  });
});
