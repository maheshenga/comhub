import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { commercialService } from '@/services/commercial';

import { TopUpPurchase } from './TopUpPurchase';

const checkout = vi.hoisted(() => ({ submit: vi.fn() }));
const paymentIntent = vi.hoisted(() => ({
  clear: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
}));
const translate = (key: string) => key;

vi.mock('@/business/client/commercialRefresh', () => ({
  refreshCommercialEntitlementState: vi.fn(),
}));
vi.mock('@/features/Payments/checkout', () => ({ submitPaymentCheckout: checkout.submit }));
vi.mock('@/services/commercial', () => ({
  commercialService: {
    createPaymentOrder: vi.fn(),
    getPaymentMethods: vi.fn(),
    getPaymentStatus: vi.fn(),
    getTopUpPackages: vi.fn(),
    recoverPaymentOrder: vi.fn(),
  },
}));
vi.mock('./paymentIntent', () => ({
  clearTopUpPaymentIntent: paymentIntent.clear,
  getOrCreateTopUpPaymentIntent: paymentIntent.create,
  readTopUpPaymentIntent: paymentIntent.read,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock('swr', () => ({
  default: (key: unknown) => {
    const name = Array.isArray(key) ? key[0] : undefined;
    if (name === 'payment.getPaymentMethods') {
      return {
        data: [{ id: 'alipay', label: 'Alipay', provider: 'alipay' }],
        isLoading: false,
      };
    }
    if (name === 'commercial.listTopUpPackages') {
      return {
        data: [
          {
            amount: 19.9,
            credits: 199_000_000,
            currency: 'CNY',
            id: 'starter',
            validityMonths: 12,
          },
        ],
        isLoading: false,
      };
    }
    if (name === 'payment.getPaymentStatus') {
      return { data: { status: 'pending' }, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  mutate: vi.fn(),
}));
vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Icon: () => null,
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Segmented: () => null,
}));
vi.mock('antd', () => ({
  Alert: ({ action, message }: { action?: ReactNode; message?: ReactNode }) => (
    <div role="alert">
      {message}
      {action}
    </div>
  ),
  QRCode: () => null,
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  },
}));

describe('TopUpPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentIntent.read.mockReturnValue({
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      method: 'alipay',
      packageId: 'starter',
    });
    vi.mocked(commercialService.recoverPaymentOrder).mockResolvedValue({
      checkout: {
        fields: { sign: 'signed' },
        method: 'POST',
        type: 'form',
        url: 'https://openapi.alipay.com/gateway.do',
      },
      orderId: '00000000-0000-4000-8000-000000000002',
      providerStatus: 'pending',
      recoveryRequired: false,
      status: 'pending',
    });
  });

  it('automatically reconciles a restored intent without resubmitting its checkout form', async () => {
    render(<TopUpPurchase />);

    await waitFor(() =>
      expect(commercialService.recoverPaymentOrder).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000001',
      ),
    );
    expect(checkout.submit).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('button', { name: 'topup.online.queryStatus' }),
    ).toBeInTheDocument();
  });
});
