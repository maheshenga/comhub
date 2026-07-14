import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PurchaseModal from './PurchaseModal';

vi.mock('@/services/moduleApp', () => ({
  moduleAppService: {
    quoteProduct: vi.fn().mockResolvedValue({ currency: 'CNY', price: 1200 }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}:${values?.amount ?? values?.percent ?? values?.date ?? ''}`,
  }),
}));

const catalog = [
  {
    amount: 1200,
    appId: 'app-1',
    billingPeriod: 'monthly',
    currency: 'CNY',
    licenseScope: 'personal',
    productId: '00000000-0000-4000-8000-000000000001',
    productType: 'subscription',
  },
];

describe('PurchaseModal', () => {
  it('shows a pending order instead of claiming purchase success', () => {
    render(
      <PurchaseModal
        open
        catalog={catalog}
        order={{ id: 'order-1', status: 'pending' }}
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('moduleApps.purchase.pending:')).toBeInTheDocument();
    expect(screen.queryByText('moduleApps.purchase.success:')).not.toBeInTheDocument();
  });

  it('does not allow a duplicate order while paid access is activating', () => {
    render(
      <PurchaseModal
        open
        catalog={catalog}
        order={{ id: 'order-paid', status: 'paid' }}
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('moduleApps.purchase.paymentConfirmed:')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /moduleApps\.purchase\.createOrder/ }),
    ).not.toBeInTheDocument();
  });

  it('shows an unavailable state when the selected scope has no products', () => {
    render(
      <PurchaseModal
        open
        catalog={[]}
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('moduleApps.purchase.noProducts:')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /moduleApps\.purchase\.createOrder/ }),
    ).not.toBeInTheDocument();
  });

  it('creates an order with the selected server catalog product', async () => {
    const onCreateOrder = vi.fn().mockResolvedValue({ id: 'order-1' });
    const onCreatePayment = vi.fn().mockResolvedValue(undefined);
    render(
      <PurchaseModal
        open
        catalog={catalog}
        subject="Recruiting Desk"
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={onCreateOrder}
        onCreatePayment={onCreatePayment}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /moduleApps\.purchase\.payWithAlipay/ }),
    );
    await waitFor(() =>
      expect(onCreateOrder).toHaveBeenCalledWith({ productId: catalog[0].productId }),
    );
    expect(onCreatePayment).toHaveBeenCalledWith({
      orderId: 'order-1',
      subject: 'Recruiting Desk',
    });
  });

  it('installs a free personal product without creating a payment order', async () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    const onCreateOrder = vi.fn();
    render(
      <PurchaseModal
        open
        catalog={[{ ...catalog[0], amount: 0, productType: 'free' }]}
        subject="Free Desk"
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={onCreateOrder}
        onCreatePayment={vi.fn()}
        onInstall={onInstall}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /moduleApps\.purchase\.install/ }));
    await waitFor(() => expect(onInstall).toHaveBeenCalledWith({ appId: 'app-1' }));
    expect(onCreateOrder).not.toHaveBeenCalled();
  });

  it('creates a payment order for a zero-price non-free product', async () => {
    const onCreateOrder = vi.fn().mockResolvedValue({ id: 'order-zero' });
    const onCreatePayment = vi.fn().mockResolvedValue(undefined);
    const onInstall = vi.fn();
    render(
      <PurchaseModal
        open
        catalog={[{ ...catalog[0], amount: 0, productType: 'one_time' }]}
        subject="Promotional Desk"
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={onCreateOrder}
        onCreatePayment={onCreatePayment}
        onInstall={onInstall}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /moduleApps\.purchase\.payWithAlipay/ }),
    );
    await waitFor(() => expect(onCreateOrder).toHaveBeenCalled());
    expect(onCreatePayment).toHaveBeenCalledWith({
      orderId: 'order-zero',
      subject: 'Promotional Desk',
    });
    expect(onInstall).not.toHaveBeenCalled();
  });

  it('requires a workspace context for team products', async () => {
    render(
      <PurchaseModal
        open
        catalog={[
          {
            ...catalog[0],
            licenseScope: 'workspace',
            productId: '00000000-0000-4000-8000-000000000002',
          },
        ]}
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('moduleApps.purchase.scope.workspace:')).toBeInTheDocument();
    expect(screen.getByText('moduleApps.purchase.workspaceRequired:')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /moduleApps\.purchase\.payWithAlipay/ }),
    ).toBeDisabled();
  });

  it('shows immutable promotion and refund snapshots and creates a scoped order', async () => {
    const onCreateOrder = vi.fn().mockResolvedValue(undefined);
    render(
      <PurchaseModal
        open
        order={{ id: 'order-refunded', status: 'refunded' }}
        workspaceId="workspace-1"
        catalog={[
          {
            ...catalog[0],
            licenseScope: 'workspace',
            productId: '00000000-0000-4000-8000-000000000002',
            promotion: {
              discountAmount: 120,
              discountPercent: 10,
              title: 'Launch offer',
              validUntil: '2026-08-01T00:00:00.000Z',
            },
          },
        ]}
        onCancelOrder={vi.fn()}
        onClose={vi.fn()}
        onCreateOrder={onCreateOrder}
      />,
    );

    expect(screen.getByText('moduleApps.purchase.refunded:')).toBeInTheDocument();
    expect(screen.getByText('Launch offer')).toBeInTheDocument();
    expect(screen.getByText('moduleApps.purchase.discountAmount:120')).toBeInTheDocument();
    expect(screen.getByText('moduleApps.purchase.discountPercent:10')).toBeInTheDocument();
    expect(screen.getByText('moduleApps.purchase.validUntil:2026-08-01T00:00:00.000Z')).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole('button', { name: /moduleApps\.purchase\.payWithAlipay/ }),
    );
    await waitFor(() =>
      expect(onCreateOrder).toHaveBeenCalledWith({
        productId: '00000000-0000-4000-8000-000000000002',
        workspaceId: 'workspace-1',
      }),
    );
  });
});
