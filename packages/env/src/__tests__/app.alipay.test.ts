// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const keys = [
  'MODULE_APP_ALIPAY_ENABLED',
  'MODULE_APP_ALIPAY_MODE',
  'MODULE_APP_ALIPAY_GATEWAY',
] as const;

afterEach(() => {
  for (const key of keys) delete process.env[key];
  vi.resetModules();
});

describe('module app Alipay environment', () => {
  it('keeps payments disabled by default and parses explicit sandbox settings', async () => {
    const { getAppConfig } = await import('../app');
    expect(getAppConfig().MODULE_APP_ALIPAY_ENABLED).toBe(false);

    process.env.MODULE_APP_ALIPAY_ENABLED = 'true';
    process.env.MODULE_APP_ALIPAY_MODE = 'sandbox';
    process.env.MODULE_APP_ALIPAY_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
    vi.resetModules();
    const { getAppConfig: getConfiguredApp } = await import('../app');
    expect(getConfiguredApp()).toMatchObject({
      MODULE_APP_ALIPAY_ENABLED: true,
      MODULE_APP_ALIPAY_MODE: 'sandbox',
    });
  });
});
