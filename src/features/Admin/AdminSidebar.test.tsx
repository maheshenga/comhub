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

  // 产品指令 10-12：侧栏只渲染两级（组 → 页面条目），子栏目不再占据层级。
  // 组标题以「组名+计数徽标」开头（textContent 如 '工作台1'）；旧三级结构
  // 会在组与条目之间插入子栏目标题节点（workbench 组的「总览」），两级结构
  // 下它不存在。
  it('renders leaf entries directly under the group without a sub-section level', async () => {
    renderSidebar('/settings/admin');

    await waitFor(() => {
      const titles = [...document.querySelectorAll('.ant-menu-submenu-title')];
      // workbench 组头存在（组名开头的 submenu-title）。
      expect(titles.some((t) => t.textContent?.startsWith('工作台'))).toBe(true);
      // 子栏目「总览」不再是任何标题节点（总览也≠组名开头，因为 workbench
      // 组的子栏目名是「总览」，而旧结构它就是一个 submenu-title）。
      const exactSubSection = titles.filter((t) => t.textContent === '总览');
      expect(exactSubSection).toHaveLength(0);
    });
  });

  // 产品指令 10-12：模块分区上提为 module-ecosystem 组下的**直挂条目**（无子
  // 栏目中间层）；模块运维子栏目的 experimental 徽标继承到子栏目第一个条目
  // （Installs）上渲染；:appId 详情页签绝不进侧栏。
  it('lifts module center sections under module-ecosystem as direct entries', async () => {
    renderSidebar('/settings/admin/modules/finance/payments');

    await expectMenuEntryMounted('Payments');
    await expectMenuEntryMounted('Revenue');
    await expectMenuEntryMounted('Installs');
    await expectMenuEntryMounted('Audit');
    // 模块运维首个条目（Installs）携带继承的 experimental 徽标（mock t 对无
    // defaultValue 的调用回退为 key 本身；存在即证明徽标渲染）。
    await waitFor(() => {
      const installs = screen.getByText('Installs').closest('li');
      expect(installs?.textContent).toContain('admin.navigation.status.experimental');
    });
    // 子栏目标题（目录与审核/模块财务/…）不再出现在侧栏任何层级。
    await expectMenuEntryAbsent('目录与审核');
    await expectMenuEntryAbsent('模块财务');
    await expectMenuEntryAbsent('模块运维');
    // :appId 详情页签（Products/Configuration/...）绝不进侧栏。
    await expectMenuEntryAbsent('Products');
    await expectMenuEntryAbsent('Configuration');
  });

  // 产品指令 10-12：角色过滤 + 空组抑制语义不变——finance_admin 无
  // moduleAppRead，Apps/Reviews/Installs 等分区条目整枝消失；可见分区条目
  // 与支付中心条目仍在（组不是空壳）。
  it('suppresses module sections a finance admin cannot access', async () => {
    userState.user = { role: 'finance_admin' };
    try {
      renderSidebar('/settings/admin/modules/finance/payments');

      await expectMenuEntryMounted('Payments');
      await expectMenuEntryMounted('Revenue');
      await expectMenuEntryMounted('Payouts');
      await expectMenuEntryAbsent('Apps');
      await expectMenuEntryAbsent('Installs');
      await expectMenuEntryAbsent('Payment Center');
    } finally {
      userState.user = { role: 'admin' };
    }
  });
});
