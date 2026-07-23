import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { moduleAppCacheKeys } from './shared/cacheKeys';

import ProductManager from './ProductManager';

const { mutate } = vi.hoisted(() => ({
  mutate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/libs/swr', () => ({
  mutate,
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

vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({
    children,
    block: _block,
    htmlType,
    icon: _icon,
    loading: _loading,
    type: _type,
    ...props
  }: any) => (
    <button type={htmlType} {...props}>
      {children}
    </button>
  ),
  Modal: ({ children, open }: any) => (open ? <div>{children}</div> : null),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'moduleApps.admin.products.add': 'Add product',
        'moduleApps.admin.products.amount': 'Amount',
        'moduleApps.admin.products.currency': 'Currency',
        'moduleApps.admin.products.edit': 'Edit product',
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
  beforeEach(() => {
    mutate.mockClear();
  });

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
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(moduleAppCacheKeys.products('app-1'));
  });

  it('updates a product and invalidates only its application products key', async () => {
    const updateProduct = vi.fn().mockResolvedValue({ id: 'product-1' });
    render(
      <ProductManager
        appId="app-1"
        service={{
          createProduct: vi.fn(),
          listProducts: vi.fn(),
          updateProduct,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit product' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith({
        licenseScope: 'personal',
        moduleMultiplier: '1',
        price: { amount: 99, currency: 'CNY', trialDays: 0 },
        productId: 'product-1',
        productType: 'one_time',
        revenueShareRate: '0',
        seatCount: undefined,
        status: 'active',
        termsVersion: '1',
      }),
    );
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(moduleAppCacheKeys.products('app-1'));
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
