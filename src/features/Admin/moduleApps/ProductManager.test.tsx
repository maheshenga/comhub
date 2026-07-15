import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ProductManager from './ProductManager';

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn().mockResolvedValue(undefined),
  useClientDataSWR: vi.fn(() => ({
    data: [
      {
        amount: 88,
        currency: 'CNY',
        licenseScope: 'personal',
        productId: 'product-1',
        productKey: 'pro',
        productType: 'one_time',
        status: 'active',
      },
    ],
    isLoading: false,
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'moduleApps.admin.products.add': 'Add product',
        'moduleApps.admin.products.amount': 'Amount',
        'moduleApps.admin.products.currency': 'Currency',
        'moduleApps.admin.products.moduleMultiplier': 'Module multiplier',
        'moduleApps.admin.products.productKey': 'Product key',
        'moduleApps.admin.products.promotionTitle': 'Promotion title',
        'moduleApps.admin.products.revenueShareRate': 'Revenue share rate',
        'moduleApps.admin.products.save': 'Save product',
        'moduleApps.admin.products.seatCount': 'Seat count',
        'moduleApps.admin.products.termsVersion': 'Terms version',
        'moduleApps.admin.products.trialDays': 'Trial days',
      })[key] ?? key,
  }),
}));

describe('ProductManager', () => {
  it('lists products and creates a server-priced product', async () => {
    const createProduct = vi.fn().mockResolvedValue({ id: 'product-2' });
    render(
      <ProductManager
        appId="app-1"
        service={{
          createProduct,
          listProducts: vi.fn(),
          updateProduct: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText('pro')).toBeInTheDocument();
    expect(screen.getByText('CNY 88')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product key'), { target: { value: 'team-pro' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Module multiplier'), { target: { value: '1.25' } });
    fireEvent.change(screen.getByLabelText('Revenue share rate'), { target: { value: '0.75' } });
    fireEvent.change(screen.getByLabelText('Seat count'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Terms version'), { target: { value: '2026-07' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'app-1',
          moduleMultiplier: '1.25',
          price: expect.objectContaining({ amount: 120, currency: 'CNY' }),
          productKey: 'team-pro',
          revenueShareRate: '0.75',
          seatCount: 12,
          termsVersion: '2026-07',
        }),
      ),
    );
  });

  it('matches the server product limits in the form controls', () => {
    render(
      <ProductManager
        appId="app-1"
        service={{
          createProduct: vi.fn(),
          listProducts: vi.fn(),
          updateProduct: vi.fn(),
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));

    expect(screen.getByLabelText('Amount')).toHaveAttribute('step', '1');
    expect(screen.getByLabelText('Currency')).toHaveAttribute('role', 'combobox');
    expect(screen.getByLabelText('Trial days')).toHaveAttribute('aria-valuemax', '365');
    expect(screen.getByLabelText('Promotion title')).toHaveAttribute('maxlength', '160');
  });
});
