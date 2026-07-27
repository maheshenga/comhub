import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TopUpPaymentsPage from './TopUpPaymentsPage';

const service = vi.hoisted(() => ({
  listTopUpPayments: vi.fn(),
  reconcilePendingTopUpPayments: vi.fn(),
  reconcileTopUpPayment: vi.fn(),
}));
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
  default: ({ columns, dataSource }: any) => (
    <div>
      {dataSource.map((row: any) => (
        <div key={row.id}>
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
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, icon: _icon, loading: _loading, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Input: (props: any) => <input {...props} />,
  Select: ({ options, onChange, ...props }: any) => (
    <select {...props} onChange={(event) => onChange?.(event.target.value)}>
      {options?.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
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
});
