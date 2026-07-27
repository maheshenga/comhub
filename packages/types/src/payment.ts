import { z } from 'zod';

export const paymentProviderSchema = z.enum(['alipay', 'wechat_pay', 'zpay']);
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const paymentMethodIdSchema = z.enum(['alipay', 'wechat_pay', 'zpay_alipay', 'zpay_wechat']);
export type PaymentMethodId = z.infer<typeof paymentMethodIdSchema>;

export const paymentPurposeSchema = z.enum(['module_app', 'top_up']);
export type PaymentPurpose = z.infer<typeof paymentPurposeSchema>;

const executablePaymentUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    const localHttp =
      url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
    return !url.username && !url.password && (url.protocol === 'https:' || localHttp);
  }, 'invalid_payment_checkout_url');

const paymentFormFieldsSchema = z
  .record(
    z.string().regex(/^[A-Z]\w{0,79}$/i, 'invalid_payment_field_name'),
    z.string().max(100_000),
  )
  .superRefine((fields, context) => {
    if (Object.keys(fields).length > 100) {
      context.addIssue({ code: 'custom', message: 'too_many_payment_fields' });
    }
  });

export const paymentCheckoutActionSchema = z.discriminatedUnion('type', [
  z
    .object({
      fields: paymentFormFieldsSchema,
      method: z.literal('POST'),
      type: z.literal('form'),
      url: executablePaymentUrlSchema,
    })
    .strict(),
  z.object({ type: z.literal('redirect'), url: executablePaymentUrlSchema }).strict(),
  z.object({ type: z.literal('qrcode'), url: z.string().min(1).max(4096) }).strict(),
]);
export type PaymentCheckoutAction = z.infer<typeof paymentCheckoutActionSchema>;

export const paymentMethodSchema = z.object({
  id: paymentMethodIdSchema,
  label: z.string().min(1).max(64),
  provider: paymentProviderSchema,
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentCreateResultSchema = z
  .object({
    checkout: paymentCheckoutActionSchema,
    method: paymentMethodIdSchema,
    outTradeNo: z.string().min(1).max(240),
    provider: paymentProviderSchema,
  })
  .strict();
export type PaymentCreateResult = z.infer<typeof paymentCreateResultSchema>;
