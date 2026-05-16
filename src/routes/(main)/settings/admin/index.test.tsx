import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SettingsAdminPage from './index';

vi.hoisted(() => {
  const store = new Map<string, string>();
  const storage = {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  } satisfies Storage;

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
  }
});

const userStoreMock = vi.hoisted(() => {
  const initialState = {
    isSignedIn: false,
    isUserStateInit: false,
    user: undefined,
  };
  const state: Record<string, any> = { ...initialState };
  const useUserStore = ((selector?: (value: typeof state) => any) =>
    typeof selector === 'function' ? selector(state) : state) as any;

  useUserStore.setState = (patch: Record<string, any>) => {
    Object.assign(state, patch);
  };
  useUserStore.reset = () => {
    Object.assign(state, initialState);
  };

  return { useUserStore };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useLocation: () => ({ pathname: locationMock.pathname }),
}));

const locationMock = vi.hoisted(() => ({
  pathname: '/settings/admin',
}));

vi.mock('@/features/Admin', () => ({
  AdminSidebar: () => <div data-testid="admin-sidebar" />,
}));

vi.mock('@/routes/(main)/admin/audit', () => ({
  default: () => <div data-testid="admin-audit" />,
}));

vi.mock('@/routes/(main)/admin/credits', () => ({
  default: () => <div data-testid="admin-credits" />,
}));

vi.mock('@/routes/(main)/admin/desktop-update', () => ({
  default: () => <div data-testid="admin-desktop-update" />,
}));

vi.mock('@/routes/(main)/admin/growth', () => ({
  default: () => <div data-testid="admin-growth" />,
}));

vi.mock('@/routes/(main)/admin/model-billing-matrix', () => ({
  default: () => <div data-testid="admin-model-billing-matrix" />,
}));

vi.mock('@/routes/(main)/admin/model-policy', () => ({
  default: () => <div data-testid="admin-model-policy" />,
}));

vi.mock('@/routes/(main)/admin/operations', () => ({
  default: () => <div data-testid="admin-operations" />,
}));

vi.mock('@/routes/(main)/admin/orders', () => ({
  default: () => <div data-testid="admin-orders" />,
}));

vi.mock('@/routes/(main)/admin/overview', () => ({
  default: () => <div data-testid="admin-overview" />,
}));

vi.mock('@/routes/(main)/admin/plans', () => ({
  default: () => <div data-testid="admin-plans" />,
}));

vi.mock('@/routes/(main)/admin/ppt', () => ({
  default: () => <div data-testid="admin-ppt" />,
}));

vi.mock('@/routes/(main)/admin/pricing', () => ({
  default: () => <div data-testid="admin-pricing" />,
}));

vi.mock('@/routes/(main)/admin/providers', () => ({
  default: () => <div data-testid="admin-providers" />,
}));

vi.mock('@/routes/(main)/admin/recommendations', () => ({
  default: () => <div data-testid="admin-recommendations" />,
}));

vi.mock('@/routes/(main)/admin/redemption', () => ({
  default: () => <div data-testid="admin-redemption" />,
}));

vi.mock('@/store/user', () => ({
  useUserStore: userStoreMock.useUserStore,
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    userProfile: (state: { user?: unknown }) => state.user,
  },
}));

vi.mock('@/routes/(main)/admin/settings', () => ({
  default: () => <div data-testid="admin-settings" />,
}));

vi.mock('@/routes/(main)/admin/stats', () => ({
  default: () => <div data-testid="admin-stats" />,
}));

vi.mock('@/routes/(main)/admin/subscriptions', () => ({
  default: () => <div data-testid="admin-subscriptions" />,
}));

vi.mock('@/routes/(main)/admin/users', () => ({
  default: () => <div data-testid="admin-users" />,
}));

vi.mock('@/routes/(main)/settings/features/SettingHeader', () => ({
  default: ({ title }: { title: string }) => <div data-testid="setting-header">{title}</div>,
}));

afterEach(() => {
  act(() => {
    userStoreMock.useUserStore.reset();
    locationMock.pathname = '/settings/admin';
  });
});

describe('SettingsAdminPage', () => {
  it('redirects non-admin users away from settings admin', () => {
    act(() => {
      userStoreMock.useUserStore.setState({
        isSignedIn: true,
        isUserStateInit: true,
        user: { id: 'user-1', role: 'user', username: 'user' } as any,
      });
    });

    render(<SettingsAdminPage />);

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
    expect(screen.queryByTestId('admin-settings')).not.toBeInTheDocument();
  });

  it('renders the admin overview for the admin root page', () => {
    act(() => {
      userStoreMock.useUserStore.setState({
        isSignedIn: true,
        isUserStateInit: true,
        user: { id: 'admin-1', role: 'admin', username: 'admin' } as any,
      });
    });

    render(<SettingsAdminPage />);

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('admin-overview')).toBeInTheDocument();
  });

  it('renders site settings for the settings admin sub-route', () => {
    act(() => {
      locationMock.pathname = '/settings/admin/settings';
      userStoreMock.useUserStore.setState({
        isSignedIn: true,
        isUserStateInit: true,
        user: { id: 'admin-1', role: 'admin', username: 'admin' } as any,
      });
    });

    render(<SettingsAdminPage />);

    expect(screen.getByTestId('admin-settings')).toBeInTheDocument();
  });

  it('renders PPT settings for the PPT admin sub-route', () => {
    act(() => {
      locationMock.pathname = '/settings/admin/ppt';
      userStoreMock.useUserStore.setState({
        isSignedIn: true,
        isUserStateInit: true,
        user: { id: 'admin-1', role: 'admin', username: 'admin' } as any,
      });
    });

    render(<SettingsAdminPage />);

    expect(screen.getByTestId('admin-ppt')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-settings')).not.toBeInTheDocument();
  });
});
