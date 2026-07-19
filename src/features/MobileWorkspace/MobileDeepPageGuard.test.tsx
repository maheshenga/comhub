import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MobileDeepPageGuard from './MobileDeepPageGuard';

const navigate = vi.fn();
const location = vi.hoisted(() => ({ key: 'default', pathname: '/apps/market' }));
const workspace = vi.hoisted(() => ({ slug: 'acme' as string | null }));

vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => navigate,
}));
vi.mock('@/business/client/hooks/useActiveWorkspaceSlug', () => ({
  useActiveWorkspaceSlug: () => workspace.slug,
}));
vi.mock('react-router', () => ({
  Outlet: () => <main>Deep page</main>,
  useLocation: () => location,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => (key === 'back' ? 'Back' : key) }),
}));
vi.mock('@lobehub/ui', () => ({ Icon: () => null }));

describe('MobileDeepPageGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    location.key = 'default';
    location.pathname = '/apps/market';
    workspace.slug = 'acme';
  });

  it('uses the safe apps fallback when a deep route was opened directly', () => {
    render(<MobileDeepPageGuard />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigate).toHaveBeenCalledWith('/apps', { escape: true });
  });

  it('uses browser history when the deep route has a previous entry', () => {
    location.key = 'history-entry';
    render(<MobileDeepPageGuard />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('uses the design fallback for directly opened creation routes', () => {
    location.pathname = '/ppt';
    render(<MobileDeepPageGuard />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigate).toHaveBeenCalledWith('/design', { escape: true });
  });

  it('keeps the workspace prefix when a workspace deep route was opened directly', () => {
    location.pathname = '/acme/apps/market';
    render(<MobileDeepPageGuard />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigate).toHaveBeenCalledWith('/apps');
  });
});
