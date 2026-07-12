// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createAlipayModuleAppWebhookHandler } from './route';

describe('Alipay module app webhook route', () => {
  it('returns success only after the normalized event is durably handled', async () => {
    const handleNotification = vi.fn().mockResolvedValue({ duplicate: false, status: 'paid' });
    const handler = createAlipayModuleAppWebhookHandler({
      autoSettlementEnabled: true,
      handleNotification,
    });
    const response = await handler(new Request('https://app.example.com/webhook', {
      body: 'signed-body',
      method: 'POST',
    }));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('success');
    expect(handleNotification).toHaveBeenCalledWith({
      body: 'signed-body',
      headers: expect.objectContaining({ 'content-type': expect.any(String) }),
    });
  });

  it('acknowledges duplicate notifications but returns failure for invalid events', async () => {
    const duplicateHandler = createAlipayModuleAppWebhookHandler({
      autoSettlementEnabled: true,
      handleNotification: vi.fn().mockResolvedValue({ duplicate: true, status: 'paid' }),
    });
    await expect((await duplicateHandler(new Request('https://app.example.com', { method: 'POST' }))).text()).resolves.toBe('success');

    const invalidHandler = createAlipayModuleAppWebhookHandler({
      autoSettlementEnabled: true,
      handleNotification: vi.fn().mockRejectedValue(new Error('MODULE_APP_PAYMENT_NOTIFICATION_INVALID')),
    });
    await expect((await invalidHandler(new Request('https://app.example.com', { method: 'POST' }))).text()).resolves.toBe('failure');
  });

  it('returns failure without persisting when automatic settlement is disabled', async () => {
    const handleNotification = vi.fn();
    const handler = createAlipayModuleAppWebhookHandler({
      autoSettlementEnabled: false,
      handleNotification,
    });

    const response = await handler(
      new Request('https://app.example.com/webhook', { body: 'signed-body', method: 'POST' }),
    );

    await expect(response.text()).resolves.toBe('failure');
    expect(handleNotification).not.toHaveBeenCalled();
  });
});
