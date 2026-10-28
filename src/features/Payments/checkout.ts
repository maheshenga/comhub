import { type PaymentCheckoutAction, paymentCheckoutActionSchema } from '@lobechat/types';

export const submitPaymentCheckout = (input: PaymentCheckoutAction) => {
  const checkout = paymentCheckoutActionSchema.parse(input);
  if (checkout.type === 'qrcode') return checkout;
  if (checkout.type === 'redirect') {
    globalThis.location.assign(checkout.url);
    return checkout;
  }
  const form = document.createElement('form');
  form.action = checkout.url;
  // HTML form methods are lower-case keywords; normalise before reflecting so
  // the attribute does not depend on the DOM implementation's casing rules.
  form.method = checkout.method.toLowerCase();
  form.style.display = 'none';
  for (const [name, value] of Object.entries(checkout.fields)) {
    const field = document.createElement('input');
    field.name = name;
    field.type = 'hidden';
    field.value = value;
    form.append(field);
  }
  document.body.append(form);
  form.submit();
  return checkout;
};
