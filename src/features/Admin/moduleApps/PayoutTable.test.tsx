import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PayoutTable from './PayoutTable';

describe('PayoutTable', () => {
  it('renders payout, revenue, transaction, and audit links', () => {
    render(
      <PayoutTable
        items={[
          {
            auditEventIds: ['audit-1'],
            currency: 'CNY',
            id: 'payout-1',
            publisherId: 'publisher-1',
            publisherName: 'Verified Studio',
            recipientMask: 'ali***@example.com',
            revenueEntryIds: ['revenue-1'],
            status: 'paid',
            totalAmount: 80,
            transactionNo: 'alipay-txn-1',
          },
        ]}
      />,
    );

    expect(screen.getByText('payout-1')).toBeInTheDocument();
    expect(screen.getByText('revenue-1')).toBeInTheDocument();
    expect(screen.getByText('alipay-txn-1')).toBeInTheDocument();
    expect(screen.getByText('audit-1')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<PayoutTable loading items={[]} />);
    expect(screen.getByLabelText('Loading payouts')).toBeInTheDocument();
  });
});
