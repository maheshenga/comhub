import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useUserStore } from '@/store/user';

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

vi.mock('@/routes/(main)/admin/settings', () => ({
  default: () => <div data-testid="admin-settings" />,
}));

vi.mock('@/routes/(main)/settings/features/SettingHeader', () => ({
  default: ({ title }: { title: string }) => <div data-testid="setting-header">{title}</div>,
}));

afterEach(() => {
  act(() => {
    useUserStore.setState({ isSignedIn: false, isUserStateInit: false, user: undefined });
  });
});

describe('SettingsAdminPage', () => {
  it('redirects non-admin users away from settings admin', () => {
    act(() => {
      useUserStore.setState({
        isSignedIn: true,
        isUserStateInit: true,
        user: { id: 'user-1', role: 'user', username: 'user' } as any,
      });
    });

    render(<SettingsAdminPage />);

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
    expect(screen.queryByTestId('admin-settings')).not.toBeInTheDocument();
  });

  it('renders settings admin for admin users', () => {
    act(() => {
      useUserStore.setState({
        isSignedIn: true,
        isUserStateInit: true,
        user: { id: 'admin-1', role: 'admin', username: 'admin' } as any,
      });
    });

    render(<SettingsAdminPage />);

    expect(screen.getByTestId('admin-settings')).toBeInTheDocument();
  });
});
