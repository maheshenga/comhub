// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';
import type { LobeChatDatabase } from '@/database/type';

import {
  getServerPaymentConfig,
  listCheckoutPaymentMethods,
  listEnabledPaymentMethods,
  type ServerPaymentConfig,
} from './config';

const { decryptAppSettingSecret } = vi.hoisted(() => ({
  decryptAppSettingSecret: vi.fn(),
}));

vi.mock('@/server/services/appSettings/secrets', () => ({ decryptAppSettingSecret }));

const configuredPayment = (): ServerPaymentConfig => ({
  alipay: {
    alipayPublicKey: 'public-key',
    appId: 'app-1',
    certMode: 'public_key',
    configured: true,
    enabled: true,
    gateway: 'https://openapi.alipay.com/gateway.do',
    merchantPrivateKey: 'private-key',
    mode: 'production',
    sellerId: 'seller-1',
  },
  defaultProvider: 'alipay',
  enabled: true,
  moduleAppEnabled: true,
  publicBaseUrl: 'https://app.example.com',
  topUpEnabled: true,
  wechat: {
    apiBaseUrl: 'https://api.mch.weixin.qq.com',
    configured: false,
    enabled: false,
  },
  zpay: {
    alipayEnabled: true,
    apiBaseUrl: 'https://zpayz.cn',
    configured: false,
    enabled: false,
    wechatEnabled: true,
  },
});

describe('payment configuration', () => {
  beforeEach(() => {
    decryptAppSettingSecret.mockImplementation(async (_key, value) => value);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not advertise checkout methods until a public callback origin is configured', () => {
    const config = { ...configuredPayment(), publicBaseUrl: undefined };

    expect(listEnabledPaymentMethods(config, 'module_app')).toHaveLength(1);
    expect(listCheckoutPaymentMethods(config, 'module_app')).toEqual([]);
  });

  it('keeps legacy module Alipay enablement and callback URLs operational during migration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('PAYMENT_ALIPAY_ENABLED', '');
    vi.stubEnv('PAYMENT_ENABLED', '');
    vi.stubEnv('PAYMENT_PUBLIC_BASE_URL', '');
    vi.stubEnv('MODULE_APP_ALIPAY_ENABLED', 'true');
    vi.stubEnv(
      'MODULE_APP_ALIPAY_NOTIFY_URL',
      'https://legacy.example.com/api/webhooks/alipay/module-app',
    );
    const db = {
      query: { appSettings: { findMany: vi.fn().mockResolvedValue([]) } },
    } as unknown as LobeChatDatabase;

    const config = await getServerPaymentConfig(db);

    expect(config.enabled).toBe(true);
    expect(config.alipay.enabled).toBe(true);
    expect(config.publicBaseUrl).toBe('https://legacy.example.com');
  });

  it('does not advertise WeChat when the API v3 key is not exactly 32 bytes', async () => {
    vi.stubEnv('PAYMENT_ENABLED', 'true');
    vi.stubEnv('PAYMENT_WECHAT_ENABLED', 'true');
    vi.stubEnv('PAYMENT_WECHAT_API_V3_KEY', 'too-short');
    vi.stubEnv('PAYMENT_WECHAT_APP_ID', 'wechat-app');
    vi.stubEnv('PAYMENT_WECHAT_MCH_ID', 'wechat-merchant');
    vi.stubEnv('PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY', 'merchant-private-key');
    vi.stubEnv('PAYMENT_WECHAT_MERCHANT_SERIAL_NO', 'merchant-serial');
    vi.stubEnv('PAYMENT_WECHAT_PLATFORM_CERTIFICATE', 'platform-certificate');
    const db = {
      query: { appSettings: { findMany: vi.fn().mockResolvedValue([]) } },
    } as unknown as LobeChatDatabase;

    const config = await getServerPaymentConfig(db);

    expect(config.wechat.configured).toBe(false);
    expect(listEnabledPaymentMethods(config, 'top_up')).not.toContainEqual(
      expect.objectContaining({ id: 'wechat_pay' }),
    );
  });

  it('isolates a damaged channel secret instead of blocking other payment methods', async () => {
    decryptAppSettingSecret.mockImplementation(async (key, value) => {
      if (key === APP_SETTING_KEYS.paymentAlipayPublicKey) {
        throw new Error('APP_SETTING_SECRET_DECRYPT_FAILED');
      }
      return value;
    });
    vi.stubEnv('PAYMENT_ENABLED', 'true');
    vi.stubEnv('PAYMENT_TOP_UP_ENABLED', 'true');
    vi.stubEnv('PAYMENT_WECHAT_ENABLED', 'true');
    vi.stubEnv('PAYMENT_WECHAT_API_V3_KEY', '12345678901234567890123456789012');
    vi.stubEnv('PAYMENT_WECHAT_APP_ID', 'wechat-app');
    vi.stubEnv('PAYMENT_WECHAT_MCH_ID', 'wechat-merchant');
    vi.stubEnv('PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY', 'merchant-private-key');
    vi.stubEnv('PAYMENT_WECHAT_MERCHANT_SERIAL_NO', 'merchant-serial');
    vi.stubEnv('PAYMENT_WECHAT_PLATFORM_CERTIFICATE', 'platform-certificate');
    const db = {
      query: {
        appSettings: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { key: APP_SETTING_KEYS.paymentAlipayPublicKey, value: 'damaged-secret' },
            ]),
        },
      },
    } as unknown as LobeChatDatabase;

    const config = await getServerPaymentConfig(db);

    expect(config.alipay.configured).toBe(false);
    expect(config.wechat.configured).toBe(true);
    expect(listEnabledPaymentMethods(config, 'top_up')).toContainEqual(
      expect.objectContaining({ id: 'wechat_pay' }),
    );
  });
});
