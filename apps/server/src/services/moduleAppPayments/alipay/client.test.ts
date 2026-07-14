// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { AlipayModuleAppClient } from './client';
import { signAlipayContent, signAlipayParameters } from './signature';

const merchantKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
});
const alipayKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
});

const createClient = (fetch = vi.fn()) => new AlipayModuleAppClient({
  alipayPublicKey: alipayKeys.publicKey,
  appId: 'app-1',
  fetch,
  gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
  merchantPrivateKey: merchantKeys.privateKey,
  sellerId: 'seller-1',
});

const signedNotification = (overrides: Record<string, string> = {}) => {
  const parameters = {
    app_id: 'app-1',
    gmt_payment: '2026-07-12 10:00:00',
    notify_id: 'notify-1',
    out_trade_no: 'mapp_00000000000040008000000000000001',
    seller_id: 'seller-1',
    total_amount: '12.34',
    trade_no: 'trade-1',
    trade_status: 'TRADE_SUCCESS',
    ...overrides,
  };
  return new URLSearchParams({
    ...parameters,
    sign: signAlipayParameters(parameters, alipayKeys.privateKey, { excludeSignType: true }),
    sign_type: 'RSA2',
  }).toString();
};

const signedResponse = (key: string, data: Record<string, unknown>) => {
  const content = JSON.stringify(data);
  const sign = signAlipayContent(content, alipayKeys.privateKey);
  return new Response(`{"${key}":${content},"sign":"${sign}"}`, { status: 200 });
};

describe('AlipayModuleAppClient', () => {
  it('creates a signed computer website payment form', async () => {
    const result = await createClient().create({
      currency: 'CNY',
      notifyUrl: 'https://app.example.com/api/webhooks/alipay/module-app',
      orderId: '00000000-0000-4000-8000-000000000001',
      returnUrl: 'https://app.example.com/apps/order-return',
      subject: 'Module App Pro',
      totalAmount: '12.340000',
    });

    expect(result.outTradeNo).toBe('mapp_00000000000040008000000000000001');
    expect(result.body).toContain('alipay.trade.page.pay');
    expect(result.body).toContain('https://openapi-sandbox.dl.alipaydev.com/gateway.do');
    expect(result.body).toContain('name="sign"');
  });

  it('rejects unsupported currencies before creating a payment form', async () => {
    await expect(
      createClient().create({
        currency: 'USD',
        notifyUrl: 'https://app.example.com/api/webhooks/alipay/module-app',
        orderId: '00000000-0000-4000-8000-000000000001',
        returnUrl: 'https://app.example.com/apps/order-return',
        subject: 'Module App Pro',
        totalAmount: '12.340000',
      }),
    ).rejects.toThrow('MODULE_APP_ALIPAY_CURRENCY_UNSUPPORTED');
  });

  it('verifies notifications and rejects wrong app or seller identities', async () => {
    const client = createClient();
    await expect(client.verifyNotification({ body: signedNotification(), headers: {} })).resolves.toMatchObject({
      eventId: 'notify-1',
      eventType: 'payment_succeeded',
      orderId: '00000000-0000-4000-8000-000000000001',
      totalAmount: '12.340000',
    });
    await expect(client.verifyNotification({ body: signedNotification({ app_id: 'wrong' }), headers: {} })).resolves.toBeNull();
    await expect(client.verifyNotification({ body: signedNotification({ seller_id: 'wrong' }), headers: {} })).resolves.toBeNull();
  });

  it('queries delayed trades, refunds, and bill download URLs through bounded fixtures', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(signedResponse('alipay_trade_query_response', {
        code: '10000', out_trade_no: 'out-1', trade_status: 'WAIT_BUYER_PAY',
      }))
      .mockResolvedValueOnce(signedResponse('alipay_trade_query_response', {
          code: '10000',
          out_trade_no: 'out-1',
          total_amount: '12.34',
          trade_no: 'trade-1',
          trade_status: 'TRADE_SUCCESS',
      }))
      .mockResolvedValueOnce(signedResponse('alipay_trade_refund_response', {
        code: '10000', out_trade_no: 'out-1', trade_no: 'trade-1',
      }))
      .mockResolvedValueOnce(signedResponse(
        'alipay_data_dataservice_bill_downloadurl_query_response',
        {
          bill_download_url: 'https://download.example.com/bill.zip',
          code: '10000',
        },
      ))
      .mockResolvedValueOnce(signedResponse('alipay_trade_fastpay_refund_query_response', {
        code: '10000',
        refund_amount: '12.34',
      }));
    const client = createClient(fetch);

    await expect(client.query({ outTradeNo: 'out-1' })).resolves.toBeNull();
    await expect(client.query({ outTradeNo: 'out-1' })).resolves.toMatchObject({ eventType: 'payment_succeeded' });
    await expect(client.refund({ outTradeNo: 'out-1', reason: 'requested', refundAmount: '12.340000' })).resolves.toMatchObject({ status: 'succeeded' });
    await expect(client.queryBillDownloadUrl({ billDate: '2026-07-11', billType: 'trade' })).resolves.toBe('https://download.example.com/bill.zip');
    await expect(client.queryRefund({ outRequestNo: 'refund-1', outTradeNo: 'out-1' })).resolves.toEqual({ status: 'succeeded' });
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('rejects unsigned API responses', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      alipay_trade_query_response: {
        code: '10000',
        out_trade_no: 'out-1',
        total_amount: '12.34',
        trade_status: 'TRADE_SUCCESS',
      },
    }), { status: 200 }));

    await expect(createClient(fetch).query({ outTradeNo: 'out-1' })).rejects.toThrow(
      'MODULE_APP_ALIPAY_RESPONSE_SIGNATURE_INVALID',
    );
  });
});
