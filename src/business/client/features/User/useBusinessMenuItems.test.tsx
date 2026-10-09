import { ADMIN_ROLE_CAPABILITIES } from '@lobechat/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUserStore } from '@/store/user';

import useBusinessMenuItems from './useBusinessMenuItems';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key) => key) })),
}));

const setRole = (role: string | undefined) => {
  useUserStore.setState({
    user: role === undefined ? undefined : ({ id: 'user-1', role, username: 'u' } as any),
  });
};

const menuKeys = (isSignin: boolean) =>
  renderHook(() => useBusinessMenuItems(isSignin))
    .result.current.map((item) =>
      item && 'key' in item ? (item as { key?: string }).key : undefined,
    )
    .filter(Boolean);

describe('useBusinessMenuItems — entry surface = gate surface (§2.4)', () => {
  it('shows the admin console entry for every recognized admin role', () => {
    for (const role of Object.keys(ADMIN_ROLE_CAPABILITIES)) {
      setRole(role);
      expect(menuKeys(true), `role '${role}' must see the admin entry`).toContain('admin-console');
    }
  });

  it('hides the admin console entry for non-admin roles and signed-out users', () => {
    for (const role of [undefined, 'user', 'agent', 'guest']) {
      setRole(role);
      expect(menuKeys(true), `role '${role}' must not see the admin entry`).not.toContain(
        'admin-console',
      );
    }
    expect(menuKeys(false)).not.toContain('admin-console');
  });

  it('uses the same isAdminRole predicate as the router-level gate', () => {
    // Scoped roles are the regression this locks in: the pre-M1 hard check
    // (`role === 'admin'`) hid the entry from scoped admins even though the
    // AdminAccessGate admits them to their default path.
    expect(ADMIN_ROLE_CAPABILITIES).toHaveProperty('module_admin');
    setRole('module_admin');
    expect(menuKeys(true)).toContain('admin-console');
  });
});
