import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ confirmModal: vi.fn(), mutate: vi.fn(), refresh: vi.fn() }));
const moduleApps = vi.hoisted(() => ({
  publish: vi.fn(),
  unpublish: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: { moduleApps },
}));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: 'admin' } }),
}));
vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: { userProfile: (state: { user: unknown }) => state.user },
}));
vi.mock('@/libs/swr', () => ({ mutate: mocks.mutate }));
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Modal: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  confirmModal: mocks.confirmModal,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import ModuleAppOverviewPage from './ModuleAppOverviewPage';

const app = {
  actions: [],
  appType: 'standard_app' as const,
  category: 'office',
  description: 'A workbench application.',
  displayName: 'Workbench',
  entitlements: [],
  icon: 'Blocks',
  id: '00000000-0000-4000-8000-000000000001',
  pages: [],
  slug: 'workbench',
  source: 'admin' as const,
  status: 'draft' as const,
  tags: ['office'],
  version: '1.0.0',
};

const ContextRoute = () => <Outlet context={{ app, refresh: mocks.refresh }} />;

describe('ModuleAppOverviewPage', () => {
  it('consumes the detail outlet context and refreshes only application caches after publish', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ContextRoute />}>
            <Route index element={<ModuleAppOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('module-app-overview')).toBeInTheDocument();
    expect(screen.getByText('Workbench')).toBeInTheDocument();
    fireEvent.click(screen.getByText('moduleApps.admin.overview.publish'));

    const [confirmation] = mocks.confirmModal.mock.calls[0] as [{ onOk: () => Promise<void> }];
    await confirmation.onOk();

    expect(moduleApps.publish).toHaveBeenCalledWith({ appId: app.id });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.arrayContaining(['admin-module-apps', 'detail', app.id]),
    );
    expect(mocks.mutate).toHaveBeenCalledWith(expect.any(Function), undefined, {
      revalidate: true,
    });
  });
});
