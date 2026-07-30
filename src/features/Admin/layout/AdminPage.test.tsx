import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AdminMetricStrip,
  AdminPageShell,
  AdminResponsiveTable,
  AdminSection,
  AdminToolbar,
} from './AdminPage';

describe('admin page primitives', () => {
  it('provides a semantic page and section hierarchy', () => {
    render(
      <AdminPageShell actions={<button>新增</button>} description="管理用户与权限" title="用户">
        <AdminSection description="最近更新" title="用户列表">
          <AdminToolbar>
            <input aria-label="搜索用户" />
          </AdminToolbar>
        </AdminSection>
      </AdminPageShell>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '用户' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '用户列表' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument();
  });

  it('exposes metrics and scrollable tables as named regions', () => {
    render(
      <>
        <AdminMetricStrip
          label="关键指标"
          items={[
            { key: 'users', label: '总用户', value: 42 },
            { hint: '过去 30 天', key: 'revenue', label: '收入', value: 'CNY 99' },
          ]}
        />
        <AdminResponsiveTable label="用户数据表">
          <table>
            <tbody>
              <tr>
                <td>用户 A</td>
              </tr>
            </tbody>
          </table>
        </AdminResponsiveTable>
      </>,
    );

    expect(screen.getByRole('region', { name: '关键指标' })).toHaveTextContent('总用户42');
    expect(screen.getByRole('region', { name: '用户数据表' })).toHaveAttribute('tabindex', '0');
  });
});
