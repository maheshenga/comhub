import type {
  ModuleAppNormalizedPaymentEvent,
  ModuleAppPaymentProvider,
} from '@lobechat/types';

export interface ModuleAppPaymentAdapter {
  create: (input: {
    notifyUrl: string;
    orderId: string;
    returnUrl: string;
    subject: string;
    totalAmount: string;
  }) => Promise<{ body: string; outTradeNo: string }>;
  query: (input: { outTradeNo: string }) => Promise<ModuleAppNormalizedPaymentEvent | null>;
  refund: (input: {
    outTradeNo: string;
    reason: string;
    refundAmount: string;
  }) => Promise<{ providerRefundId: string; status: string }>;
  verifyNotification: (input: {
    body: string;
    headers: Record<string, string>;
  }) => Promise<ModuleAppNormalizedPaymentEvent | null>;
}

export type { ModuleAppNormalizedPaymentEvent, ModuleAppPaymentProvider };
