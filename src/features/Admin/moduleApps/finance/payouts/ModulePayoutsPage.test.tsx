import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModulePayoutsPage from './ModulePayoutsPage';

const moduleApps = vi.hoisted(() => ({
  createPayoutBatch: vi.fn(),
  listPayouts: vi.fn(),
  recordManualAlipayPayout: vi.fn(),
  transitionPayoutBatch: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const state = vi.hoisted(() => ({
  data: { items: [], nextCursor: null } as { items: any[]; nextCursor: null | string },
  error: undefined as Error | undefined,
}));

vi.mock('@lobechat/types', () => ({
  ADMIN_CAPABILITIES: { financeWrite: 'finance.write' },
  hasAdminCapability: () => true,
}));
vi.mock('@/services/adminCommercial', () => ({ adminCommercialService: { moduleApps } }));
vi.mock('@/store/user', () => ({ useUserStore: (selector: any) => selector({ user: {} }) }));
vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: { userProfile: (store: any) => store.user },
}));
vi.mock('@/libs/swr', () => ({
  mutate: mocks.mutate,
  useClientDataSWR: (_key: unknown, fetcher: () => Promise<unknown>) => {
    void fetcher();
    return { data: state.data, error: state.error, isLoading: false };
  },
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  Input: ({ onChange, ...props }: any) => <input onChange={(e) => onChange?.(e)} {...props} />,
  InputNumber: ({ max, min, onChange, ...props }: any) => (
    <input
      aria-valuemax={max}
      aria-valuemin={min}
      type="number"
      onChange={(e) => onChange?.(e.target.value === '' ? undefined : Number(e.target.value))}
      {...props}
    />
  ),
  Select: ({ options: _o, ...props }: any) => (
    <select
      role="combobox"
      onChange={(e: any) => props.onChange?.(e.target.value)}
      {...props}
      value={props.value}
    />
  ),
  SelectItem: (props: any) => <option {...props} />,
  TextArea: ({ onChange, ...props }: any) => (
    <textarea onChange={(e) => onChange?.(e)} {...props} />
  ),
  Checkbox: ({ checked, onChange, ...props }: any) => (
    <input
      checked={checked}
      type="checkbox"
      onChange={(e) => onChange?.(e.target.checked)}
      {...props}
    />
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Modal: (props: any) =>
    props.open ? (
      <div>
        {props.children}
        <button disabled={props.okButtonProps?.disabled} type="button" onClick={props.onOk}>
          {props.okText}
        </button>
      </div>
    ) : null,
  toast,
  Tag: ({ children, color }: any) => <span data-color={color}>{children}</span>,
  Alert: ({ message, children, description }: any) => (
    <div role="alert">
      {message}
      {description}
      {children}
    </div>
  ),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('ModulePayoutsPage', () => {
  beforeEach(() => {
    state.data = { items: [], nextCursor: null };
    state.error = undefined;
    vi.clearAllMocks();
  });

  it('restores payout filters from the URL and hides writes for readers', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/settings/admin/modules/finance/payouts?status=failed&publisherId=publisher-1&cursor=cursor-1',
        ]}
      >
        <ModulePayoutsPage canWrite={false} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(moduleApps.listPayouts).toHaveBeenCalledWith({
        cursor: 'cursor-1',
        limit: 25,
        publisherId: 'publisher-1',
        status: 'failed',
      }),
    );
    expect(screen.getByTestId('module-payouts-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'moduleApps.admin.payouts.create' })).toBeNull();
  });

  it('creates a payout and refreshes only the current payout cache', async () => {
    state.data = {
      items: [
        {
          auditEventIds: [],
          currency: 'CNY',
          id: '00000000-0000-4000-8000-000000000021',
          publisherId: 'publisher-1',
          publisherName: 'Studio',
          revenueEntryIds: [],
          status: 'pending',
          totalAmount: 80,
        },
      ],
      nextCursor: null,
    };
    moduleApps.createPayoutBatch.mockResolvedValue({ id: 'payout-2' });
    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/finance/payouts?status=pending']}>
        <ModulePayoutsPage canWrite />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.payouts.create' }));
    fireEvent.change(screen.getByLabelText('moduleApps.admin.payouts.form.publisherId'), {
      target: { value: '00000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText('moduleApps.admin.payouts.form.requestedAmount'), {
      target: { value: '80' },
    });
    fireEvent.change(screen.getByLabelText('moduleApps.admin.payouts.form.revenueEntryIds'), {
      target: { value: '00000000-0000-4000-8000-000000000011' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'moduleApps.admin.payouts.confirm.create' }),
    );

    await waitFor(() => expect(moduleApps.createPayoutBatch).toHaveBeenCalled());
    expect(mocks.mutate).toHaveBeenCalledWith([
      'admin-module-apps',
      'payouts',
      'status=pending',
      '',
    ]);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  // 提现是资金写动作。提交后弹窗直接关闭会让管理员拿不到任何受理确认，
  // 与同工作面 revenue/payments 的 toast.success 不一致。
  it('confirms a successful payout write with a toast', async () => {
    state.data = {
      items: [
        {
          auditEventIds: [],
          currency: 'CNY',
          id: '00000000-0000-4000-8000-000000000021',
          publisherId: 'publisher-1',
          publisherName: 'Studio',
          revenueEntryIds: [],
          status: 'pending',
          totalAmount: 80,
        },
      ],
      nextCursor: null,
    };
    moduleApps.createPayoutBatch.mockResolvedValue({ id: 'payout-2' });
    render(
      <MemoryRouter initialEntries={['/settings/admin/modules/finance/payouts?status=pending']}>
        <ModulePayoutsPage canWrite />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'moduleApps.admin.payouts.create' }));
    fireEvent.change(screen.getByLabelText('moduleApps.admin.payouts.form.publisherId'), {
      target: { value: '00000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText('moduleApps.admin.payouts.form.requestedAmount'), {
      target: { value: '80' },
    });
    fireEvent.change(screen.getByLabelText('moduleApps.admin.payouts.form.revenueEntryIds'), {
      target: { value: '00000000-0000-4000-8000-000000000011' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'moduleApps.admin.payouts.confirm.create' }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('moduleApps.admin.payouts.actionSuccess'),
    );
  });
});
