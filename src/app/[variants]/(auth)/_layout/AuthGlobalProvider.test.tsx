/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deserializeVariantsMock = vi.hoisted(() => vi.fn());
const getServerAuthConfigMock = vi.hoisted(() => vi.fn());
const serverConfigStoreProviderMock = vi.hoisted(() => vi.fn());
const authServerConfigProviderMock = vi.hoisted(() => vi.fn());

vi.mock('@/envs/app', () => ({
  appEnv: {
    CDN_USE_GLOBAL: false,
  },
}));

vi.mock('@/utils/server/routeVariants', () => ({
  RouteVariants: {
    deserializeVariants: deserializeVariantsMock,
  },
}));

vi.mock('@/server/globalConfig/getServerAuthConfig', () => ({
  getServerAuthConfig: getServerAuthConfigMock,
}));

vi.mock('@/layout/GlobalProvider/StyleRegistry', () => ({
  default: ({ children }: React.PropsWithChildren) => <div data-testid="style-registry">{children}</div>,
}));

vi.mock('./AuthLocale', () => ({
  default: ({ children }: React.PropsWithChildren) => <div data-testid="auth-locale">{children}</div>,
}));

vi.mock('@/layout/GlobalProvider/NextThemeProvider', () => ({
  default: ({ children }: React.PropsWithChildren) => (
    <div data-testid="next-theme-provider">{children}</div>
  ),
}));

vi.mock('./AuthThemeLite', () => ({
  default: ({ children }: React.PropsWithChildren<{ globalCDN?: boolean }>) => (
    <div data-testid="auth-theme-lite">{children}</div>
  ),
}));

vi.mock('@/store/serverConfig/Provider', () => ({
  ServerConfigStoreProvider: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    serverConfigStoreProviderMock(props);
    return <div data-testid="server-config-store-provider">{children}</div>;
  },
}));

vi.mock('./AuthServerConfigProvider', () => ({
  AuthServerConfigProvider: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    authServerConfigProviderMock(props);
    return <div data-testid="auth-server-config-provider">{children}</div>;
  },
}));

vi.mock('@/layout/AuthProvider', () => ({
  default: ({ children }: React.PropsWithChildren) => <div data-testid="auth-provider">{children}</div>,
}));

import AuthGlobalProvider from './AuthGlobalProvider';

describe('AuthGlobalProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deserializeVariantsMock.mockReturnValue({ isMobile: true, locale: 'zh-CN' });
    getServerAuthConfigMock.mockReturnValue({
      aiProvider: {},
      enableMagicLink: true,
      telemetry: {},
    });
  });

  it('wraps auth routes with the shared server config store provider', async () => {
    const tree = await AuthGlobalProvider({
      children: <div data-testid="auth-child">signin</div>,
      variants: 'zh-CN-mobile',
    });

    render(tree);

    expect(screen.getByTestId('server-config-store-provider')).toBeTruthy();
    expect(screen.getByTestId('auth-server-config-provider')).toBeTruthy();
    expect(screen.getByTestId('auth-child')).toBeTruthy();

    expect(serverConfigStoreProviderMock).toHaveBeenCalledTimes(1);
    expect(serverConfigStoreProviderMock).toHaveBeenCalledWith({
      isMobile: true,
      segmentVariants: 'zh-CN-mobile',
      serverConfig: {
        aiProvider: {},
        enableMagicLink: true,
        telemetry: {},
      },
    });

    expect(authServerConfigProviderMock).toHaveBeenCalledTimes(1);
    expect(authServerConfigProviderMock).toHaveBeenCalledWith({
      isMobile: true,
      segmentVariants: 'zh-CN-mobile',
      serverConfig: {
        aiProvider: {},
        enableMagicLink: true,
        telemetry: {},
      },
    });
  });
});
