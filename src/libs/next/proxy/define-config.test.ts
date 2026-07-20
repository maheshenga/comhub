/**
 * @vitest-environment node
 */
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { LOBE_LOCALE_COOKIE } from '@/const/locale';

import { defineConfig } from './define-config';

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://example.com',
    MIDDLEWARE_REWRITE_THROUGH_LOCAL: false,
  },
}));

vi.mock('@/envs/auth', () => ({
  authEnv: {
    ENABLE_OIDC: false,
  },
}));

const createRequest = (path: string, headers?: HeadersInit) => {
  const request = new NextRequest(new URL(path, 'https://example.com'), { headers });
  const cookieHeader = new Headers(headers).get('cookie');

  if (cookieHeader) {
    for (const item of cookieHeader.split(';')) {
      const [key, value] = item.trim().split('=');
      if (key && value) request.cookies.set(key, value);
    }
  }

  return request;
};

const getRewriteUrl = async (path: string, headers?: HeadersInit) => {
  const { middleware } = defineConfig();
  const response = await middleware(createRequest(path, headers));
  const rewrite = response.headers.get('x-middleware-rewrite');

  if (!rewrite) throw new Error('Expected middleware rewrite header');

  return new URL(rewrite);
};

const getAuthenticatedRewriteUrl = async (path: string, headers?: HeadersInit) => {
  vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' } } as never);

  return getRewriteUrl(path, headers);
};

describe('defineConfig middleware locale routing', () => {
  it('serves sign-in through the upstream Next.js auth route with default zh-CN locale', async () => {
    const rewrite = await getRewriteUrl('/signin', {
      'accept-language': 'en-US,en;q=0.9',
    });

    expect(rewrite.pathname).toBe('/zh-CN__0/signin');
  });

  it('serves sign-in through the upstream Next.js auth route with locale cookie', async () => {
    const rewrite = await getRewriteUrl('/signin', {
      Cookie: `${LOBE_LOCALE_COOKIE}=en-US`,
    });

    expect(rewrite.pathname).toBe('/en-US__0/signin');
  });

  it('serves sign-in through the upstream Next.js auth route with query-string locale', async () => {
    const rewrite = await getRewriteUrl('/signin?hl=ja-JP', {
      Cookie: `${LOBE_LOCALE_COOKIE}=en-US`,
    });

    expect(rewrite.pathname).toBe('/ja-JP__0/signin');
  });
});

describe('defineConfig backend service routes', () => {
  it('allows desktop release writeback to use its own bearer token auth', async () => {
    const { middleware } = defineConfig();
    vi.mocked(auth.api.getSession).mockClear();

    const response = await middleware(
      createRequest('/api/admin/desktop-release', {
        authorization: 'Bearer release-token',
      }),
    );

    expect(auth.api.getSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('defineConfig mobile workspace routes', () => {
  const mobileUserAgent =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  const tabletUserAgent =
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

  it('serves mobile discover through the SPA', async () => {
    const mobileRewrite = await getAuthenticatedRewriteUrl('/discover', {
      'user-agent': mobileUserAgent,
    });

    expect(mobileRewrite.pathname).toBe('/spa/zh-CN__1/discover');
  });

  it('serves tablet discover through the mobile SPA', async () => {
    const tabletRewrite = await getAuthenticatedRewriteUrl('/discover', {
      'user-agent': tabletUserAgent,
    });

    expect(tabletRewrite.pathname).toBe('/spa/zh-CN__1/discover');
  });

  it('redirects desktop legacy discover paths before authentication', async () => {
    const { middleware } = defineConfig();
    vi.mocked(auth.api.getSession).mockClear();

    const response = await middleware(createRequest('/discover/agent?source=legacy'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://example.com/community/agent?source=legacy',
    );
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });
});

describe('defineConfig locale path-traversal hardening', () => {
  it('falls back to en-US for a traversal locale (plain)', async () => {
    const rewrite = await getRewriteUrl('/signin?hl=../../api/dev/x');

    expect(rewrite.pathname).toBe('/en-US__0/signin');
  });

  it('falls back to en-US for a traversal locale (percent-encoded)', async () => {
    const rewrite = await getRewriteUrl('/signin?hl=..%2F..%2Fapi%2Fdev%2Fx');

    expect(rewrite.pathname).toBe('/en-US__0/signin');
  });
});
