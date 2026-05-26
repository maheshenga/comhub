import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsTabs } from '@/store/global/initialState';
import { ServerConfigStoreProvider } from '@/store/serverConfig/Provider';
import { useUserStore } from '@/store/user';

import { useCategory } from './useCategory';

const localStorageMock = vi.hoisted(() => {
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

  return storage;
});

const wrapper: React.JSXElementConstructor<{ children: React.ReactNode }> = ({ children }) => (
  <ServerConfigStoreProvider>{children}</ServerConfigStoreProvider>
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

const hasAdminItem = (groups: ReturnType<typeof useCategory>) =>
  groups.some((group) => group.items.some((item) => item.key === SettingsTabs.Admin));

afterEach(() => {
  localStorageMock.clear();
  act(() => {
    useUserStore.setState({ isSignedIn: false, user: undefined });
  });
});

describe('settings useCategory', () => {
  it('hides admin settings entry for non-admin users', () => {
    act(() => {
      useUserStore.setState({
        isSignedIn: true,
        user: { id: 'user-1', role: 'user', username: 'user' } as any,
      });
    });

    const { result } = renderHook(() => useCategory(), { wrapper });

    expect(hasAdminItem(result.current)).toBe(false);
  });

  it('shows admin settings entry for admin users', () => {
    act(() => {
      useUserStore.setState({
        isSignedIn: true,
        user: { id: 'admin-1', role: 'admin', username: 'admin' } as any,
      });
    });

    const { result } = renderHook(() => useCategory(), { wrapper });

    expect(hasAdminItem(result.current)).toBe(true);
  });
});
