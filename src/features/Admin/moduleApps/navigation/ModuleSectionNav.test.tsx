import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import ModuleSectionNav from './ModuleSectionNav';

/**
 * B8b：模块中心二级树形侧栏已下线，本组件收窄为应用详情页的页签导航。
 * 分区级导航（角色过滤 / 状态徽标 / 空组抑制）由主侧栏接管，其行为锁定在
 * adminNavigation.test.ts；这里锁定 detail 页签的角色过滤与状态徽标语义。
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));

describe('ModuleSectionNav (app detail tabs)', () => {
  it('renders no tabs for finance admins (moduleAppRead denied)', () => {
    render(
      <MemoryRouter>
        <ModuleSectionNav appId="app-1" role="finance_admin" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the detail tabs for module-capable roles without status badges', () => {
    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/apps/app-1']}>
        <ModuleSectionNav appId="app-1" role="admin" />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation');
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')?.split('/').at(-1)),
    ).toEqual(['app-1', 'configuration', 'entitlements', 'products', 'runtime']);
    // 详情页签的五个分区在 sectionStatus.ts 里均为 active，无 [data-status] 徽标。
    for (const link of within(nav).getAllByRole('link')) {
      expect(link.querySelector('[data-status]')).toBeNull();
    }
    expect(screen.queryByRole('link', { name: 'audit' })).not.toBeInTheDocument();
  });

  it('uses localized labels for every center and detail section', () => {
    const zh = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'locales/zh-CN/common.json'), 'utf8'),
    );
    const centerKeys = [
      'overview',
      'apps',
      'reviews',
      'publishers',
      'finance',
      'revenue',
      'payments',
      'payouts',
      'operations',
      'installs',
      'records',
      'runs',
      'artifacts',
      'audit',
    ];
    const detailKeys = ['overview', 'configuration', 'entitlements', 'products', 'runtime'];

    expect(
      Object.fromEntries(
        centerKeys.map((key) => [key, zh[`moduleApps.admin.center.navigation.${key}`]]),
      ),
    ).toEqual({
      apps: '应用',
      artifacts: '产物',
      audit: '审计',
      finance: '财务',
      installs: '安装',
      operations: '运维',
      overview: '概览',
      payments: '支付',
      payouts: '提现',
      publishers: '发布方',
      records: '记录',
      revenue: '收入',
      reviews: '审核',
      runs: '运行',
    });
    expect(
      Object.fromEntries(
        detailKeys.map((key) => [key, zh[`moduleApps.admin.center.detailNavigation.${key}`]]),
      ),
    ).toEqual({
      configuration: '配置',
      entitlements: '权益',
      overview: '概览',
      products: '商品',
      runtime: '运行状态',
    });
  });
});
