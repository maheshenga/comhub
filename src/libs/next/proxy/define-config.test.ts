import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { LOBE_LOCALE_COOKIE } from '@/const/locale';

import { defineConfig } from './define-config';

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
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

describe('defineConfig middleware locale routing', () => {
  it('defaults public entry routes to zh-CN without a locale cookie', async () => {
    const rewrite = await getRewriteUrl('/signin', {
      'accept-language': 'en-US,en;q=0.9',
    });

    expect(rewrite.pathname).toBe('/zh-CN__0/signin');
  });

  it('respects an explicit locale cookie from the language switcher', async () => {
    const rewrite = await getRewriteUrl('/signin', {
      Cookie: `${LOBE_LOCALE_COOKIE}=en-US`,
    });

    expect(rewrite.pathname).toBe('/en-US__0/signin');
  });

  it('keeps query-string locale as the highest priority', async () => {
    const rewrite = await getRewriteUrl('/signin?hl=ja-JP', {
      Cookie: `${LOBE_LOCALE_COOKIE}=en-US`,
    });

    expect(rewrite.pathname).toBe('/ja-JP__0/signin');
  });
});
