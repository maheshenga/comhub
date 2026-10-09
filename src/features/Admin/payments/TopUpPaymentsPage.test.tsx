import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TopUpPaymentsPage from './TopUpPaymentsPage';

const service = vi.hoisted(() => ({
  bulkRefundTopUpPayments: vi.fn(),
  listTopUpPayments: vi.fn(),
  reconcilePendingTopUpPayments: vi.fn(),
  reconcileTopUpPayment: vi.fn(),
  refundTopUpPayment: vi.fn(),
  resolveTopUpPaymentRefund: vi.fn(),
}));
// 批量退款入口 mock 成捕获 props：用例断言页面把 actionId 与 onRun 接到充值域端点。
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
              type="checkbox"
              aria-label={`select-${row.id}`}
              disabled={rowSelection.getCheckboxProps?.(row).disabled}
              checked={rowSelection.selectedRowKeys?.includes(row.id)}
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

describe('TopUpPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bulkFlow.captures.length = 0;
    state.data = { items: [], nextCursor: null };
    state.error = undefined;
  });

  it('restores an order handoff from the URL and queries only online top-ups', async () => {
    const orderId = '00000000-0000-4000-8000-000000000001';

    render(
      <MemoryRouter
        initialEntries={[
          `/admin/payments?tab=topups&orderId=${orderId}&provider=alipay&status=failed&userId=user-1&cursor=25`,
        ]}
      >
        <TopUpPaymentsPage canWrite={false} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(service.listTopUpPayments).toHaveBeenCalledWith({
        cursor: 25,
        limit: 25,
        orderId,
        provider: 'alipay',
        status: 'failed',
        userId: 'user-1',
      }),
    );
    expect(screen.getByTestId('top-up-payments-page')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'admin.payments.topups.reconcilePending' }),
    ).toBeNull();
  });

  it('ignores invalid URL-backed provider and status filters', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=topups&provider=offline&status=unknown']}>
        <TopUpPaymentsPage canWrite={false} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(service.listTopUpPayments).toHaveBeenCalledWith({
        cursor: 0,
        limit: 25,
        orderId: undefined,
        provider: undefined,
        status: undefined,
        userId: undefined,
      }),
    );
  });

  it('reconciles a pending transaction and refreshes its list', async () => {
    const orderId = '00000000-0000-4000-8000-000000000001';
    state.data = {
      items: [
        {
          amount: '19.90',
          createdAt: new Date().toISOString(),
          credits: '199000000',
          currency: 'CNY',
          externalOrderId: 'trade-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          method: 'alipay',
          packageId: 'starter',
          paidAt: null,
          paymentReference: null,
          provider: 'alipay',
          refundReference: null,
          refundStatus: null,
          status: 'pending',
          updatedAt: new Date().toISOString(),
          userEmail: 'user@example.com',
          userId: 'user-1',
          userName: null,
        },
      ],
      nextCursor: null,
    };
    service.reconcileTopUpPayment.mockResolvedValue({ orderId, status: 'paid' });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=topups']}>
        <TopUpPaymentsPage canWrite />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'admin.payments.topups.reconcile' }));

    await waitFor(() => expect(service.reconcileTopUpPayment).toHaveBeenCalledWith(orderId));
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });

  it('allows reconciliation when a canceled payment still has an unresolved refund', async () => {
    const orderId = '00000000-0000-4000-8000-000000000001';
    state.data = {
      items: [
        {
          amount: '19.90',
          createdAt: new Date().toISOString(),
          credits: '199000000',
          currency: 'CNY',
          externalOrderId: 'trade-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          method: 'alipay',
          packageId: 'starter',
          paidAt: new Date().toISOString(),
          paymentReference: 'trade-1',
          provider: 'alipay',
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
    service.reconcileTopUpPayment.mockResolvedValue({ orderId, status: 'refunded' });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=topups']}>
        <TopUpPaymentsPage canWrite />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'admin.payments.topups.reconcile' }));

    await waitFor(() => expect(service.reconcileTopUpPayment).toHaveBeenCalledWith(orderId));
  });

  it('warns when a pending reconciliation batch has partial failures', async () => {
    service.reconcilePendingTopUpPayments.mockResolvedValue({
      count: 3,
      failedCount: 1,
      results: [
        { ok: true, orderId: 'order-1' },
        { error: 'PROVIDER_TIMEOUT', ok: false, orderId: 'order-2' },
        { ok: true, orderId: 'order-3' },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=topups']}>
        <TopUpPaymentsPage canWrite />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'admin.payments.topups.reconcilePending' }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith('admin.payments.topups.reconcilePartial'),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });

  it('requires a reason and submits a paid top-up refund', async () => {
    const orderId = '00000000-0000-4000-8000-000000000001';
    state.data = {
      items: [
        {
          amount: '19.90',
          createdAt: new Date().toISOString(),
          credits: '199000000',
          currency: 'CNY',
          externalOrderId: 'trade-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          method: 'alipay',
          packageId: 'starter',
          paidAt: new Date().toISOString(),
          paymentReference: 'trade-1',
          provider: 'alipay',
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
    service.refundTopUpPayment.mockResolvedValue({ debtAmount: 0, status: 'refunded' });
    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=topups']}>
        <TopUpPaymentsPage canWrite />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'admin.payments.topups.refund' }));
    fireEvent.change(screen.getByLabelText('admin.payments.topups.refundReason'), {
      target: { value: 'duplicate charge' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'admin.payments.topups.confirmRefund' }));

    await waitFor(() =>
      expect(service.refundTopUpPayment).toHaveBeenCalledWith({
        orderId,
        reason: 'duplicate charge',
      }),
    );
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });

  it('requires a verification note before resolving a pending ZPay refund', async () => {
    const orderId = '00000000-0000-4000-8000-000000000001';
    state.data = {
      items: [
        {
          amount: '19.900000',
          createdAt: '2026-07-29T00:00:00.000Z',
          credits: '1000',
          currency: 'CNY',
          externalOrderId: 'zpay-order-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          method: 'zpay_alipay',
          packageId: 'starter',
          paidAt: '2026-07-29T00:00:00.000Z',
          paymentReference: 'zpay-trade-1',
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
    service.resolveTopUpPaymentRefund.mockResolvedValue({ status: 'failed' });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=topups']}>
        <TopUpPaymentsPage canWrite />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'admin.payments.topups.manualResolution.action' }),
    );
    const confirm = screen.getByRole('button', {
      name: 'admin.payments.topups.manualResolution.confirm',
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('admin.payments.topups.manualResolution.note'), {
      target: { value: '  no refund record in merchant portal  ' },
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('admin.payments.topups.manualResolution.outcome'), {
      target: { value: 'failed' },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(service.resolveTopUpPaymentRefund).toHaveBeenCalledWith({
        note: 'no refund record in merchant portal',
        orderId,
        resolution: 'failed',
      }),
    );
  });

  it('wires the bulk refund entry to the top-up domain endpoint', async () => {
    const orderId = '00000000-0000-4000-8000-000000000001';
    state.data = {
      items: [
        {
          amount: '19.90',
          createdAt: new Date().toISOString(),
          credits: '1000',
          currency: 'CNY',
          externalOrderId: 'provider-order-1',
          id: orderId,
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
          metadata: { method: 'wechat_pay' },
          packageId: 'starter',
          paidAt: null,
          paymentReference: null,
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
    service.bulkRefundTopUpPayments.mockResolvedValue({
      batchCorrelationId: 'batch-1',
      dryRun: false,
      failed: 0,
      results: [{ ok: true, orderId }],
      succeeded: 1,
      total: 1,
    });

    render(
      <MemoryRouter initialEntries={['/admin/payments?tab=topups']}>
        <TopUpPaymentsPage canWrite />
      </MemoryRouter>,
    );

    // 勾选 paid 行 → selectedRefundCount>0 → 页头渲染批量退款入口。
    fireEvent.click(screen.getByRole('checkbox', { name: `select-${orderId}` }));

    // 评审修复回归防线：充值页批量入口必须携带充值域 actionId，
    // 且信封原样落到 bulkRefundTopUpPayments（topUpOrders 域）。
    expect(bulkFlow.captures.length).toBeGreaterThan(0);
    const flow = bulkFlow.captures.at(-1);
    expect(flow.actionId).toBe('payment.bulkRefund');
    const command = {
      actionId: 'payment.bulkRefund',
      confirmationText: 'payment.bulkRefund',
      confirmed: true,
      reason: 'duplicate charge',
    };
    await flow.onRun(command);
    expect(service.bulkRefundTopUpPayments).toHaveBeenCalledWith([orderId], command);
  });
});
