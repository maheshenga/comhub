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
        'moduleApps.admin.products.productKey': 'Product key',
        'moduleApps.admin.products.save': 'Save product',
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
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'app-1',
          price: expect.objectContaining({ amount: 120, currency: 'CNY' }),
          productKey: 'team-pro',
        }),
      ),
    );
  });
});
