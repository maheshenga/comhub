import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminSidebar from './AdminSidebar';

// 本仓库 vitest 不启用 globals → @testing-library/react 的自动 cleanup 不生
// 效；多次 render 会残留在同一 document 里污染 screen 查询，必须显式清理。
afterEach(() => {
  cleanup();
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
  }),
}));

const userState = { user: { role: 'admin' } as unknown };

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { user: unknown }) => unknown) => selector(userState),
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    userProfile: (state: { user: unknown }) => state.user,
  },
}));

const renderSidebar = (pathname: string) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AdminSidebar />
    </MemoryRouter>,
  );

/**
 * antd inline Menu 的挂载语义：只有 openKeys 命中的一级组会挂载 `<ul>` 内容，
 * 其中**子栏目标题**（submenu-title）同步可查；子栏目自身的叶子条目要等该
 * 子栏目被展开才懒挂载。因此 DOM 层断言落在子栏目标题文本上（存在/被抑制
 * ——空子栏目整枝不挂载标题，这是可观测的空组抑制证据）；叶子级角色过滤的
 * 精确行为由 adminNavigation.test.ts 的数据层测试锁定。
 * 异步挂载统一走 waitFor。注：不用 role 查询——antd 给 submenu-title 加
 * aria-haspopup，accessible name 计算在 jsdom 下不稳定。
 */
const expectMenuEntryMounted = async (name: string) => {
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
};

const expectMenuEntryAbsent = async (name: string) => {
  await waitFor(() => {
    expect(screen.queryByText(name)).toBeNull();
  });
};

describe('AdminSidebar', () => {
  it('uses the search input as the only search label', () => {
    renderSidebar('/settings/admin');

    expect(screen.getByRole('searchbox', { name: '搜索管理功能' })).toBeInTheDocument();
    expect(screen.queryByText('搜索管理功能')).not.toBeInTheDocument();
  });

  // B8 需求 1：一级栏目 → 子栏目两级渲染；子栏目为纯文字条目（C7，无图标，
  // workbench 组的「总览」子栏目 title 不含 anticon 图标）。
  it('renders sub-section entries under their top-level group', async () => {
    renderSidebar('/settings/admin');

    await expectMenuEntryMounted('总览');
    const subSectionTitle = screen.getByRole('menuitem', { name: '总览', hidden: true });
    expect(subSectionTitle.querySelector('.anticon')).toBeNull();
  });

  // B8 需求 4：模块分区上提为 module-ecosystem 组下的子栏目条目（组随路由
  // 自动展开，四个子栏目标题全部挂载）；模块运维子栏目带实验性徽标。
  it('lifts module center sections under module-ecosystem as sub-section entries', async () => {
    renderSidebar('/settings/admin/modules/finance/payments');

    await expectMenuEntryMounted('目录与审核');
    await expectMenuEntryMounted('模块财务');
    await expectMenuEntryMounted('模块运维');
    await expectMenuEntryMounted('模块审计');
    // 模块运维子栏目标题携带 experimental 徽标（mock t 对无 defaultValue 的
    // 调用回退为 key 本身，因此徽标文本是裸 key；存在即证明徽标渲染）。
    await waitFor(() => {
      const title = screen.getByText('模块运维').closest('.ant-menu-submenu-title');
      expect(title?.textContent).toContain('admin.navigation.status.experimental');
    });
    // :appId 详情页签（Products/Configuration/...）绝不进侧栏。
    await expectMenuEntryAbsent('Products');
    await expectMenuEntryAbsent('Configuration');
  });

  // B8 需求 2：角色过滤 + 空组抑制——finance_admin 无 moduleAppRead，模块
  // 运维子栏目整枝消失（标题不挂载），Apps/Reviews 等分区条目不挂载；目录
  // 与审计子栏目仍在（组不是空壳）。
  it('suppresses module sections a finance admin cannot access', async () => {
    userState.user = { role: 'finance_admin' };
    try {
      renderSidebar('/settings/admin/modules/finance/payments');

      await expectMenuEntryMounted('目录与审核');
      await expectMenuEntryMounted('模块财务');
      await expectMenuEntryMounted('模块审计');
      await expectMenuEntryAbsent('模块运维');
      await expectMenuEntryAbsent('Apps');
      await expectMenuEntryAbsent('Installs');
      await expectMenuEntryAbsent('Payment Center');
    } finally {
      userState.user = { role: 'admin' };
    }
  });
});
