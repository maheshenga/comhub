import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { AdminModuleAppDetail } from '../types';
import ModuleAppDetailLayout, { type ModuleAppDetailOutletContext } from './ModuleAppDetailLayout';

/**
 * B8b：模块中心二级树形侧栏布局壳（ModuleCenterLayout / 216px aside）已下线，
 * 分区页并入后台主栏单栏形态——本文件只保留仍挂载的应用详情布局断言；center
 * 模式的角色过滤 / 状态徽标 / 空组抑制由主侧栏两级导航接管
 * （adminNavigation.ts 的 getAdminNavSectionsForRole / SUB_SECTION_STATUS_OVERRIDES）。
 */

const detailState = vi.hoisted(() => ({
  app: undefined as AdminModuleAppDetail | undefined,
  error: undefined as unknown,
  isLoading: false,
  refresh: vi.fn(),
}));

vi.mock('../shared/useModuleAppDetail', () => ({ useModuleAppDetail: () => detailState }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
vi.mock('../navigation/ModuleSectionNav', () => ({
  default: () => <nav data-testid="module-nav-detail" />,
}));

const DetailChild = () => {
  const { app } = useOutletContext<ModuleAppDetailOutletContext>();
  return <div>{app.displayName} child</div>;
};

describe('module layouts', () => {
  it('renders a stable app header and provides app context to nested routes', () => {
    detailState.app = {
      actions: [],
      appType: 'standard_app',
      category: 'productivity',
      displayName: 'Calendar',
      entitlements: [],
      icon: 'calendar',
      id: 'app-1',
      pages: [],
      slug: 'calendar',
      status: 'draft',
    } as AdminModuleAppDetail;
    detailState.error = undefined;
    detailState.isLoading = false;

    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/apps/app-1']}>
        <Routes>
          <Route element={<ModuleAppDetailLayout />} path="/settings/admin/modules/apps/:appId">
            <Route index element={<DetailChild />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByTestId('module-nav-detail')).toBeInTheDocument();
    expect(screen.getByText('Calendar child')).toBeInTheDocument();
  });

  it('shows a true not-found state without rendering nested detail content', () => {
    detailState.app = undefined;
    detailState.error = undefined;
    detailState.isLoading = false;

    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/apps/missing']}>
        <Routes>
          <Route element={<ModuleAppDetailLayout />} path="/settings/admin/modules/apps/:appId">
            <Route element={<Outlet />}>
              <Route index element={<div>should not render</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('appNotFoundTitle')).toBeInTheDocument();
    expect(screen.queryByText('should not render')).not.toBeInTheDocument();
  });
});
