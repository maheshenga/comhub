import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CommerceTable from './CommerceTable';

describe('module app commerce table', () => {
  it('settles only selected pending accrual entries', async () => {
    const onSettle = vi.fn().mockResolvedValue(undefined);

    render(
      <CommerceTable
        items={[
          {
            appId: 'app-1',
            currency: 'CNY',
            developerAmount: 7200,
            grossAmount: 10_000,
            id: 'entry-1',
            orderId: 'order-1',
            platformFee: 2000,
            reserveAmount: 800,
            status: 'pending',
            type: 'accrual',
          },
          {
            appId: 'app-1',
            currency: 'CNY',
            developerAmount: -7200,
            grossAmount: -10_000,
            id: 'entry-2',
            orderId: 'order-1',
            platformFee: -2000,
            reserveAmount: -800,
            status: 'reversed',
            type: 'reversal',
          },
        ]}
        onSettle={onSettle}
      />,
    );

    expect(screen.getAllByText('order-1')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Settle selected' })).toBeDisabled();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[1]).toBeDisabled();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Settle selected' }));

    await waitFor(() => expect(onSettle).toHaveBeenCalledWith(['entry-1']));
  });
});
