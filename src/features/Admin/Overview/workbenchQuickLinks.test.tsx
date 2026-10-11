import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkbenchQuickLinks } from './workbenchDashboardCards';

const { useUserStoreMock } = vi.hoisted(() => ({ useUserStoreMock: vi.fn() }));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { userProfile?: { role?: string } }) => unknown) =>
    useUserStoreMock(selector),
}));
vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    userProfile: (state: { userProfile?: { role?: string } }) => state.userProfile,
  },
}));

const renderLinks = () =>
  render(
    <MemoryRouter>
      <WorkbenchQuickLinks />
    </MemoryRouter>,
  );

const setRole = (role: string) => {
  useUserStoreMock.mockImplementation((selector) => selector({ userProfile: { role } }));
};

describe('WorkbenchQuickLinks', () => {
  beforeEach(() => {
    setRole('admin');
  });

  it('never lists the workbench group as its own quick-link section', () => {
    renderLinks();

    expect(screen.getByRole('heading', { name: '模型与生成' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '工作台' })).not.toBeInTheDocument();
  });

  it('shows every group a full admin can reach', () => {
    renderLinks();

    for (const label of ['用户与支持', '资金与商业化', '模块生态', '桌面端发版', '审计与合规']) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    }
  });

  it('restricts the quick links to the sections the signed-in role can reach', () => {
    // M8：这些入口此前对所有角色渲染，点进去会被 AdminAccessGate 拦下。
    setRole('module_admin');
    renderLinks();

    expect(screen.getByRole('heading', { name: '模块生态' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '资金与商业化' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '平台配置与运维' })).not.toBeInTheDocument();
  });

  it('hides sections a scoped role cannot open even when a sibling section is reachable', () => {
    setRole('support_admin');
    renderLinks();

    expect(screen.getByRole('heading', { name: '用户与支持' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '用户默认值' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '用户默认值' })).not.toBeInTheDocument();
  });
});
