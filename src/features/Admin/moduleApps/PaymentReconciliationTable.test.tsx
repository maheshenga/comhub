import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PaymentReconciliationTable from './PaymentReconciliationTable';

describe('PaymentReconciliationTable', () => {
  it('renders linked operational identifiers without raw payment metadata', () => {
    render(
      <PaymentReconciliationTable
        items={[
          {
            appId: 'app-1',
            appName: 'Commerce App',
            auditEventIds: ['audit-1'],
            currency: 'CNY',
            discrepancyIds: ['discrepancy-1'],
            id: 'attempt-1',
            licenseIds: ['license-1'],
            latestAppRuntimeInvocationId: 'run-1',
            orderId: 'order-1',
            orderStatus: 'paid',
            outTradeNo: 'out-1',
            paymentEventIds: ['event-1'],
            paymentStatus: 'paid',
            payoutBatchIds: ['payout-1'],
            refundIds: ['refund-1'],
            revenueEntryIds: ['revenue-1'],
            totalAmount: '88.00',
          },
        ]}
      />,
    );

    expect(screen.getByText('order-1')).toBeInTheDocument();
    expect(screen.getByText('event-1')).toBeInTheDocument();
    expect(screen.getByText('payout-1')).toBeInTheDocument();
    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.queryByText(/signature/i)).not.toBeInTheDocument();
  });

  it('renders permission denial and retries', () => {
    const onRetry = vi.fn();
    render(
      <PaymentReconciliationTable
        error={new Error('FORBIDDEN')}
        items={[]}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Permission denied')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
