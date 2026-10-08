import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AdminAccessGate } from './AdminAccessGate';

const userStoreMock = vi.hoisted(() => {
  const state: Record<string, any> = { user: undefined };
  const selectUserStore = ((selector?: (value: typeof state) => any) =>
    typeof selector === 'function' ? selector(state) : state) as any;
  selectUserStore.setState = (patch: Record<string, any>) => {
    Object.assign(state, patch);
  };
  return { useUserStore: selectUserStore };
});

vi.mock('@/store/user', () => ({ useUserStore: userStoreMock.useUserStore }));
vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: { userProfile: (state: { user?: unknown }) => state.user },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="gate-redirect" data-to={to} />,
  };
});

const renderGate = (pathname: string) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AdminAccessGate>
        <div data-testid="gated-content" />
      </AdminAccessGate>
    </MemoryRouter>,
  );

describe('AdminAccessGate', () => {
  it('renders gated content for the full admin role', () => {
    userStoreMock.useUserStore.setState({ user: { id: 'admin-1', role: 'admin' } });

    renderGate('/settings/admin/users');

    expect(screen.getByTestId('gated-content')).toBeInTheDocument();
  });

  it('renders gated content for a scoped role on an allowed path', () => {
    userStoreMock.useUserStore.setState({ user: { id: 'fin-1', role: 'finance_admin' } });

    renderGate('/settings/admin/subscriptions');

    expect(screen.getByTestId('gated-content')).toBeInTheDocument();
  });

  it('bounces non-admin roles to the denied fallback', () => {
    userStoreMock.useUserStore.setState({ user: { id: 'user-1', role: 'user' } });

    renderGate('/settings/admin/users');

    expect(screen.queryByTestId('gated-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('gate-redirect')).toHaveAttribute('data-to', '/');
  });

  it('bounces scoped roles away from cross-domain admin paths', () => {
    userStoreMock.useUserStore.setState({ user: { id: 'fin-1', role: 'finance_admin' } });

    renderGate('/settings/admin/settings');

    expect(screen.queryByTestId('gated-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('gate-redirect')).toHaveAttribute(
      'data-to',
      '/settings/admin/subscriptions',
    );
  });

  it('bounces unknown roles even when the user object exists', () => {
    userStoreMock.useUserStore.setState({ user: { id: 'bot-1', role: 'agent' } });

    renderGate('/settings/admin/overview');

    expect(screen.queryByTestId('gated-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('gate-redirect')).toHaveAttribute('data-to', '/');
  });
});
