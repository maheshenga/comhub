/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CreditPackageList from './CreditPackageList';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  packages: [] as Record<string, unknown>[],
  error: undefined as Error | undefined,
  isLoading: false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@lobehub/ui', () => ({
  // shared.tsx 的 BusinessTableError 从这里取 Button。
  Button: ({ children, ...props }: { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Flexbox: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Select: () => <div />,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, ...props }: { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Select: () => <div />,
  Tabs: ({ items }: { items?: { key: string; label: ReactNode }[] }) => (
    <div>
      {items?.map((item) => (
        <span key={item.key}>{item.label}</span>
      ))}
    </div>
  ),
}));

// InlineTable 只在「加载成功」分支渲染；mock 成一个可见标记，一旦错误态
// 仍然落到空表分支，这个标记就会出现，测试即红。
vi.mock('@/components/InlineTable', () => ({
  default: () => <div data-testid="credit-package-table" />,
}));

vi.mock('antd', () => ({
  Empty: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
}));

vi.mock('./mobile/BusinessMobileRecordList', () => ({
  default: () => <div data-testid="mobile-record-list" />,
}));

vi.mock('./mobile/businessRecordBuilders', () => ({
  buildCreditPackageRecord: () => ({}),
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: () => ({
    data: mocks.packages,
    error: mocks.error,
    isLoading: mocks.isLoading,
    mutate: mocks.mutate,
  }),
}));

vi.mock('@/services/commercial', () => ({
  commercialService: { listCreditPackages: vi.fn() },
}));

describe('CreditPackageList desktop error state', () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.packages = [];
    mocks.error = undefined;
    mocks.isLoading = false;
  });

  it('renders a retryable error instead of an empty package table when the request fails', () => {
    mocks.error = new Error('network failed');

    render(<CreditPackageList />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('credit-package-table')).not.toBeInTheDocument();
    // 空态文案不能出现：它会把一次加载失败说成「你还没有积分包」。
    expect(screen.queryByText('暂无积分包，购买您的第一个积分包')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'mobile.error.retry' }));
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });

  it('does not label the tabs with zero counts when the request failed', () => {
    mocks.error = new Error('network failed');

    render(<CreditPackageList />);

    // 三个状态标签原本会渲染成「有效（0）」「已用尽（0）」「已过期（0）」，
    // 把一次故障伪装成真实的零统计并引导用户重复购买。
    expect(screen.queryByText(/（0）/)).not.toBeInTheDocument();
  });

  it('still renders the table with real counts on a successful empty response', () => {
    render(<CreditPackageList />);

    expect(screen.getByTestId('credit-package-table')).toBeInTheDocument();
    // 三个标签都是（0），成功返回空列表是真实情况，计数必须照常显示。
    expect(screen.getAllByText(/（0）/)).toHaveLength(3);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
