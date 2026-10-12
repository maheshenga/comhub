/**
 * @vitest-environment happy-dom
 */
import { act, render, screen } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useElectronStore } from '@/store/electron';

// The settings sidebar is portal'd into the shell (frozen root router on
// desktop). This binds `@/hooks/useActiveLocation` to the real desktop variant,
// which mirrors the active tab's url from the electron store, and asserts the
// sidebar's active-tab highlight follows a store-driven tab switch — the
// Critical-2 regression (raw useLocation would freeze at the boot url).
vi.mock('@/hooks/useActiveLocation', async () => await import('@/hooks/useActiveLocation.desktop'));

// NOTE: this mock deliberately does NOT memoize — `useCategory: () => [...]`
// returns a fresh array on every call, so `categoryGroups` changes identity each
// render. That is intentional regression coverage: Body's openKeys sync must key
// its effect on the resolved group *string*, not on the array identity. Keying it
// on the array makes setOpenKeys fire every render, which loops until the vitest
// worker dies with exit code 134 (a crash, not an assertion failure — it shows up
// as `Test Files (1)` with no pass/fail word). Do not "tidy" this mock into a
// stable reference; that would silently delete the guard.
vi.mock('../../hooks/useCategory', () => ({
  SettingsGroupKey: { Account: 'account', General: 'general' },
  useCategory: () => [
    {
      items: [
        { icon: () => null, key: 'profile', label: 'Profile' },
        { icon: () => null, key: 'appearance', label: 'Appearance' },
      ],
      key: 'account',
      title: 'Account',
    },
  ],
}));

vi.mock('@/features/SettingsSearch', () => ({
  getTabUrl: (tab: string) => `/settings/${tab}`,
  SearchSection: ({ children }: { children?: ReactNode }) => h('div', null, children),
}));

vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => vi.fn(),
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({ active, title }: { active?: boolean; title: ReactNode }) =>
    h('button', { 'data-active': String(!!active), 'type': 'button' }, title),
}));

vi.mock('react-router', () => ({
  Link: ({ children }: { children?: ReactNode }) => h('span', null, children),
}));

const tab = (id: string, url: string) => ({ id, lastVisited: 0, url });

const activeStateOf = (label: string) =>
  screen.getByText(label).closest('button')?.getAttribute('data-active');

afterEach(() => {
  useElectronStore.setState({ activeTabId: null, tabs: [] });
});

describe('settings sidebar active tab (desktop)', () => {
  it('follows the active tab url via the electron store mirror', async () => {
    useElectronStore.setState({
      activeTabId: 't1',
      tabs: [tab('t1', '/settings/profile'), tab('t2', '/settings/appearance')],
    });

    const { default: Body } = await import('./index');
    render(h(Body));

    expect(activeStateOf('Profile')).toBe('true');
    expect(activeStateOf('Appearance')).toBe('false');

    act(() => useElectronStore.setState({ activeTabId: 't2' }));

    expect(activeStateOf('Profile')).toBe('false');
    expect(activeStateOf('Appearance')).toBe('true');
  });
});
