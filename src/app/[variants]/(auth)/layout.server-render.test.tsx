import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import AuthLayout from './layout';

vi.mock('nuqs/adapters/next/app', () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="nuqs-adapter">{children}</div>
  ),
}));

vi.mock('@/business/client/BusinessAuthProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="business-auth-provider">{children}</div>
  ),
}));

vi.mock('./_layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('./_layout/AuthGlobalProvider', () => ({
  default: ({ children, variants }: { children: React.ReactNode; variants: string }) => (
    <section data-variants={variants}>{children}</section>
  ),
}));

describe('AuthLayout server render', () => {
  it('keeps the auth page content in the initial server markup', async () => {
    const element = await AuthLayout({
      children: <div>signin form</div>,
      params: Promise.resolve({ variants: 'zh-CN__0' }),
    } as any);

    expect(renderToString(element)).toContain('signin form');
  });
});
