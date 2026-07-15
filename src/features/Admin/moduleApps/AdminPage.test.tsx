import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminModuleAppsPage from './AdminPage';

const authState = vi.hoisted(() => ({ role: 'admin' }));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: authState.role } }),
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    userProfile: (state: { user?: unknown }) => state.user,
  },
}));

vi.mock('./FinancePage', () => ({
  default: () => <div data-testid="module-app-finance-page" />,
}));

vi.mock('./index', () => ({
  default: () => <div data-testid="module-app-governance-page" />,
}));

describe('AdminModuleAppsPage', () => {
  beforeEach(() => {
    authState.role = 'admin';
  });

  it('loads the governance surface for full admins', async () => {
    render(<AdminModuleAppsPage />);

    expect(await screen.findByTestId('module-app-governance-page')).toBeInTheDocument();
    expect(screen.queryByTestId('module-app-finance-page')).not.toBeInTheDocument();
  });

  it('loads only the finance surface for finance admins', async () => {
    authState.role = 'finance_admin';

    render(<AdminModuleAppsPage />);

    expect(await screen.findByTestId('module-app-finance-page')).toBeInTheDocument();
    expect(screen.queryByTestId('module-app-governance-page')).not.toBeInTheDocument();
  });

  it('keeps governance and finance code in role-selected lazy bundles', () => {
    const source = readFileSync(path.resolve(__dirname, 'AdminPage.tsx'), 'utf8');

    expect(source).toContain("lazy(() => import('./FinancePage'))");
    expect(source).toContain("lazy(() => import('./index'))");
    expect(source).not.toContain("import ModuleAppGovernancePage from './index'");
  });

  it('renders no surface for unrelated scoped roles', () => {
    authState.role = 'content_admin';

    const { container } = render(<AdminModuleAppsPage />);

    expect(container).toBeEmptyDOMElement();
  });
});
