import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SubscriptionPaymentsPage from './SubscriptionPaymentsPage';

const service = vi.hoisted(() => ({
  bulkRefundSubscriptionPayments: vi.fn(),
  listSubscriptionPayments: vi.fn(),
  reconcilePendingSubscriptionPayments: vi.fn(),
  reconcileSubscriptionPayment: vi.fn(),
  refundSubscriptionPayment: vi.fn(),
  resolveSubscriptionPaymentRefund: vi.fn(),
}));
// 批量退款入口 mock 成捕获 props：用例断言页面把 actionId 与 onRun 接到订阅域端点。
const bulkFlow = vi.hoisted(() => ({ captures: [] as any[] }));
const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
const state = vi.hoisted(() => ({
  data: { items: [], nextCursor: null } as { items: any[]; nextCursor: null | number },
  error: undefined as Error | undefined,
}));

vi.mock('@lobechat/types', () => ({
  ADMIN_CAPABILITIES: { financeWrite: 'finance.write' },
  hasAdminCapability: () => true,
}));
vi.mock('@/services/adminCommercial', () => ({ adminCommercialService: service }));
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
vi.mock('@/components/InlineTable', () => ({
  default: ({ columns, dataSource, rowSelection }: any) => (
    <div>
      {dataSource.map((row: any) => (
        <div key={row.id}>
          {rowSelection ? (
            <input
              aria-label={`select-${row.id}`}
              checked={rowSelection.selectedRowKeys?.includes(row.id)}
              disabled={rowSelection.getCheckboxProps?.(row).disabled}
              type="checkbox"
              onChange={(event) =>
                rowSelection.onChange(
                  event.target.checked
                    ? [...(rowSelection.selectedRowKeys ?? []), row.id]
                    : (rowSelection.selectedRowKeys ?? []).filter((key: any) => key !== row.id),
                )
              }
            />
          ) : null}
          {columns.map((column: any) => (
            <span key={column.key ?? column.dataIndex}>
              {column.render
                ? column.render(column.dataIndex ? row[column.dataIndex] : undefined, row)
                : row[column.dataIndex]}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}));
vi.mock('@/features/Admin/AdminBulkActionFlow', () => ({
  default: (props: any) => {
    bulkFlow.captures.push(props);
    return null;
  },
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, icon: _icon, loading: _loading, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Input: (props: any) => <input {...props} />,
  Modal: ({ children, okButtonProps, okText, onCancel, onOk, open, title }: any) =>
    open ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={onCancel}>
          cancel
        </button>
        <button type="button" {...okButtonProps} onClick={onOk}>
          {okText}
        </button>
      </div>
    ) : null,
  Select: ({ options, onChange, ...props }: any) => (
    <select {...props} onChange={(event) => onChange?.(event.target.value)}>
      {options?.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  TextArea: (props: any) => <textarea {...props} />,
  toast,
}));
vi.mock('antd', () => ({
  Alert: ({ message }: any) => <div role="alert">{message}</div>,
  Space: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const orderId = '00000000-0000-4000-8000-000000000001';

describe('SubscriptionPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bulkFlow.captures.length = 0;
    state.data = { items: [], nextCursor: null };
    state.error = undefined;
  });

  it('restores filters from the URL and queries plan payment orders', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/admin/payments?tab=subscriptions&orderId=${orderId}&provider=wechat_pay&status=pending&userId=user-1`,
        ]}
      >
        <SubscriptionPaymentsPage canWrite={false} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(service.listSubscriptionPayments).toHaveBeenCalledWith({
        cursor: 0,
        limit: 25,
        orderId,
        provider: 'wechat_pay',
        status: 'pending',
        userId: 'user-1',
      }),
    );
    expect(screen.getByTestId('subscription-payments-page')).toBeInTheDocument();
  });

  it('submits a full plan refund with an operator reason', async () => {
    state.data = {
      items: [
        {
          amount: '68.00',
          createdAt: new Date().toISOString(),
          currency: 'CNY',
          cycle: 'monthly',
          displayName: 'Starter',
          externalOrderId: 'subscription-trade-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          method: 'wechat_pay',
          monthlyCredits: 5000,
          paidAt: new Date().toISOString(),
          plan: 'starter',
          provider: 'wechat_pay',
          refundReference: null,
          refundStatus: null,
          status: 'paid',
          updatedAt: new Date().toISOString(),
          userEmail: 'user@example.com',
          userId: 'user-1',
          userName: null,
        },
      ],
      nextCursor: null,
    };
    service.refundSubscriptionPayment.mockResolvedValue({ debtAmount: 0, status: 'refunded' });
    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=subscriptions']}>
        <SubscriptionPaymentsPage canWrite />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'admin.payments.subscriptions.refund' }));
    fireEvent.change(screen.getByLabelText('admin.payments.subscriptions.refundReason'), {
      target: { value: 'duplicate purchase' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'admin.payments.subscriptions.confirmRefund' }),
    );

    await waitFor(() =>
      expect(service.refundSubscriptionPayment).toHaveBeenCalledWith({
        orderId,
        reason: 'duplicate purchase',
      }),
    );
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });

  it('allows reconciliation when a canceled plan payment still has an unresolved refund', async () => {
    state.data = {
      items: [
        {
          amount: '68.00',
          createdAt: new Date().toISOString(),
          currency: 'CNY',
          cycle: 'lifetime',
          displayName: 'Starter',
          externalOrderId: 'subscription-trade-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          method: 'wechat_pay',
          monthlyCredits: 5000,
          paidAt: new Date().toISOString(),
          plan: 'starter',
          provider: 'wechat_pay',
          refundReference: 'refund-1',
          refundStatus: 'pending',
          status: 'canceled',
          updatedAt: new Date().toISOString(),
          userEmail: 'user@example.com',
          userId: 'user-1',
          userName: null,
        },
      ],
      nextCursor: null,
    };
    service.reconcileSubscriptionPayment.mockResolvedValue({ orderId, status: 'refunded' });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=subscriptions']}>
        <SubscriptionPaymentsPage canWrite />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'admin.payments.subscriptions.reconcile' }));

    await waitFor(() => expect(service.reconcileSubscriptionPayment).toHaveBeenCalledWith(orderId));
  });

  it('manually confirms a pending ZPay refund with operator evidence', async () => {
    const orderId = '00000000-0000-4000-8000-000000000010';
    state.data = {
      items: [
        {
          amount: '68.000000',
          createdAt: '2026-07-29T00:00:00.000Z',
          currency: 'CNY',
          cycle: 'monthly',
          displayName: 'Pro',
          externalOrderId: 'zpay-subscription-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000011',
          method: 'zpay_wechat',
          monthlyCredits: '1000',
          paidAt: '2026-07-29T00:00:00.000Z',
          plan: 'pro',
          provider: 'zpay',
          refundReference: 'zr-request-1',
          refundStatus: 'pending',
          status: 'paid',
          updatedAt: '2026-07-29T00:00:00.000Z',
          userEmail: 'user@example.com',
          userId: 'user-1',
          userName: null,
        },
      ],
      nextCursor: null,
    };
    service.resolveSubscriptionPaymentRefund.mockResolvedValue({ status: 'refunded' });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=subscriptions']}>
        <SubscriptionPaymentsPage canWrite />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'admin.payments.subscriptions.manualResolution.action',
      }),
    );
    const confirm = screen.getByRole('button', {
      name: 'admin.payments.subscriptions.manualResolution.confirm',
    });
    fireEvent.change(screen.getByLabelText('admin.payments.subscriptions.manualResolution.note'), {
      target: { value: 'merchant portal shows completed refund' },
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText('admin.payments.subscriptions.manualResolution.outcome'),
      { target: { value: 'succeeded' } },
    );
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(service.resolveSubscriptionPaymentRefund).toHaveBeenCalledWith({
        note: 'merchant portal shows completed refund',
        orderId,
        resolution: 'succeeded',
      }),
    );
  });

  it('wires the bulk refund entry to the subscription domain endpoint', async () => {
    state.data = {
      items: [
        {
          amount: '68.00',
          createdAt: new Date().toISOString(),
          currency: 'CNY',
          cycle: 'monthly',
          displayName: 'Starter',
          externalOrderId: 'subscription-trade-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          method: 'wechat_pay',
          monthlyCredits: 5000,
          paidAt: new Date().toISOString(),
          plan: 'starter',
          provider: 'wechat_pay',
          refundReference: null,
          refundStatus: null,
          status: 'paid',
          updatedAt: new Date().toISOString(),
          userEmail: 'user@example.com',
          userId: 'user-1',
          userName: null,
        },
      ],
      nextCursor: null,
    };
    service.bulkRefundSubscriptionPayments.mockResolvedValue({
      batchCorrelationId: 'batch-1',
      dryRun: false,
      failed: 0,
      results: [{ ok: true, orderId }],
      succeeded: 1,
      total: 1,
    });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=subscriptions']}>
        <SubscriptionPaymentsPage canWrite />
      </MemoryRouter>,
    );

    // 勾选 paid 行 → selectedRefundCount>0 → 页头渲染批量退款入口。
    fireEvent.click(screen.getByRole('checkbox', { name: `select-${orderId}` }));

    // 评审修复回归防线：订阅页批量入口必须携带订阅域 actionId，
    // 且信封原样落到 bulkRefundSubscriptionPayments（subscriptionPaymentOrders 域），
    // 不得再走 topUpOrders 域的 bulkRefundTopUpPayments。
    expect(bulkFlow.captures.length).toBeGreaterThan(0);
    const flow = bulkFlow.captures.at(-1);
    expect(flow.actionId).toBe('payment.subscriptionBulkRefund');
    const command = {
      actionId: 'payment.subscriptionBulkRefund',
      confirmationText: 'payment.subscriptionBulkRefund',
      confirmed: true,
      reason: 'duplicate purchase',
    };
    await flow.onRun(command);
    expect(service.bulkRefundSubscriptionPayments).toHaveBeenCalledWith([orderId], command);
  });
});
