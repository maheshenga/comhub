'use client';

import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';

export type PaymentFormValues = {
  alipayAppCertSn: string;
  alipayAppId: string;
  alipayCertMode: 'certificate' | 'public_key';
  alipayCertificate: string;
  alipayEnabled: boolean;
  alipayGateway: string;
  alipayMerchantPrivateKey: string;
  alipayMode: 'production' | 'sandbox';
  alipayPublicKey: string;
  alipayRootCertSn: string;
  alipaySellerId: string;
  defaultProvider: 'alipay' | 'wechat_pay' | 'zpay';
  enabled: boolean;
  moduleAppEnabled: boolean;
  publicBaseUrl: string;
  subscriptionEnabled: boolean;
  topUpEnabled: boolean;
  wechatApiBaseUrl: string;
  wechatApiV3Key: string;
  wechatAppId: string;
  wechatEnabled: boolean;
  wechatMchId: string;
  wechatMerchantPrivateKey: string;
  wechatMerchantSerialNo: string;
  wechatPlatformCertificate: string;
  wechatPlatformCertificateSerialNo: string;
  zpayAlipayEnabled: boolean;
  zpayApiBaseUrl: string;
  zpayEnabled: boolean;
  zpayMerchantId: string;
  zpayMerchantKey: string;
  zpayWechatEnabled: boolean;
};

export type PaymentSettingsData = {
  paymentConfig?: {
    alipay?: {
      appCertSn?: string;
      appId?: string;
      certMode?: PaymentFormValues['alipayCertMode'];
      certificateConfigured?: boolean;
      certificateMasked?: null | string;
      configured?: boolean;
      enabled?: boolean;
      gateway?: string;
      merchantPrivateKeyConfigured?: boolean;
      merchantPrivateKeyMasked?: null | string;
      mode?: PaymentFormValues['alipayMode'];
      publicKeyConfigured?: boolean;
      publicKeyMasked?: null | string;
      rootCertSn?: string;
      sellerId?: string;
    };
    defaultProvider?: PaymentFormValues['defaultProvider'];
    enabled?: boolean;
    moduleAppEnabled?: boolean;
    publicBaseUrl?: string;
    source?: {
      backendManaged?: boolean;
      legacyEnvironmentKeys?: string[];
    };
    subscriptionEnabled?: boolean;
    topUpEnabled?: boolean;
    wechat?: {
      apiBaseUrl?: string;
      apiV3KeyConfigured?: boolean;
      apiV3KeyMasked?: null | string;
      appId?: string;
      configured?: boolean;
      enabled?: boolean;
      mchId?: string;
      merchantPrivateKeyConfigured?: boolean;
      merchantPrivateKeyMasked?: null | string;
      merchantSerialNo?: string;
      platformCertificateConfigured?: boolean;
      platformCertificateMasked?: null | string;
      platformCertificateSerialNo?: string;
    };
    zpay?: {
      alipayEnabled?: boolean;
      apiBaseUrl?: string;
      configured?: boolean;
      enabled?: boolean;
      merchantId?: string;
      merchantKeyConfigured?: boolean;
      merchantKeyMasked?: null | string;
      wechatEnabled?: boolean;
    };
  };
  paymentGatewayStatus?: {
    configured: boolean;
    enabled: boolean;
    methods: string[];
  };
};

export const SECRET_FIELDS = [
  'alipayCertificate',
  'alipayMerchantPrivateKey',
  'alipayPublicKey',
  'wechatApiV3Key',
  'wechatMerchantPrivateKey',
  'wechatPlatformCertificate',
  'zpayMerchantKey',
] as const satisfies readonly (keyof PaymentFormValues)[];

export const buildInitialValues = (data?: PaymentSettingsData): PaymentFormValues => {
  const config = data?.paymentConfig;
  return {
    alipayAppCertSn: config?.alipay?.appCertSn ?? '',
    alipayAppId: config?.alipay?.appId ?? '',
    alipayCertMode: config?.alipay?.certMode ?? 'public_key',
    alipayCertificate: '',
    alipayEnabled: config?.alipay?.enabled ?? false,
    alipayGateway: config?.alipay?.gateway ?? '',
    alipayMerchantPrivateKey: '',
    alipayMode: config?.alipay?.mode ?? 'sandbox',
    alipayPublicKey: '',
    alipayRootCertSn: config?.alipay?.rootCertSn ?? '',
    alipaySellerId: config?.alipay?.sellerId ?? '',
    defaultProvider: config?.defaultProvider ?? 'alipay',
    enabled: config?.enabled ?? false,
    moduleAppEnabled: config?.moduleAppEnabled ?? false,
    publicBaseUrl: config?.publicBaseUrl ?? '',
    subscriptionEnabled: config?.subscriptionEnabled ?? false,
    topUpEnabled: config?.topUpEnabled ?? false,
    wechatApiBaseUrl: config?.wechat?.apiBaseUrl ?? 'https://api.mch.weixin.qq.com',
    wechatApiV3Key: '',
    wechatAppId: config?.wechat?.appId ?? '',
    wechatEnabled: config?.wechat?.enabled ?? false,
    wechatMchId: config?.wechat?.mchId ?? '',
    wechatMerchantPrivateKey: '',
    wechatMerchantSerialNo: config?.wechat?.merchantSerialNo ?? '',
    wechatPlatformCertificate: '',
    wechatPlatformCertificateSerialNo: config?.wechat?.platformCertificateSerialNo ?? '',
    zpayAlipayEnabled: config?.zpay?.alipayEnabled ?? true,
    zpayApiBaseUrl: config?.zpay?.apiBaseUrl ?? 'https://zpayz.cn',
    zpayEnabled: config?.zpay?.enabled ?? false,
    zpayMerchantId: config?.zpay?.merchantId ?? '',
    zpayMerchantKey: '',
    zpayWechatEnabled: config?.zpay?.wechatEnabled ?? true,
  };
};

export const FIELD_KEYS: Record<keyof PaymentFormValues, string> = {
  alipayAppCertSn: APP_SETTING_KEYS.paymentAlipayAppCertSn,
  alipayAppId: APP_SETTING_KEYS.paymentAlipayAppId,
  alipayCertMode: APP_SETTING_KEYS.paymentAlipayCertMode,
  alipayCertificate: APP_SETTING_KEYS.paymentAlipayCertificate,
  alipayEnabled: APP_SETTING_KEYS.paymentAlipayEnabled,
  alipayGateway: APP_SETTING_KEYS.paymentAlipayGateway,
  alipayMerchantPrivateKey: APP_SETTING_KEYS.paymentAlipayMerchantPrivateKey,
  alipayMode: APP_SETTING_KEYS.paymentAlipayMode,
  alipayPublicKey: APP_SETTING_KEYS.paymentAlipayPublicKey,
  alipayRootCertSn: APP_SETTING_KEYS.paymentAlipayRootCertSn,
  alipaySellerId: APP_SETTING_KEYS.paymentAlipaySellerId,
  defaultProvider: APP_SETTING_KEYS.paymentDefaultProvider,
  enabled: APP_SETTING_KEYS.paymentEnabled,
  moduleAppEnabled: APP_SETTING_KEYS.paymentModuleAppEnabled,
  publicBaseUrl: APP_SETTING_KEYS.paymentPublicBaseUrl,
  subscriptionEnabled: APP_SETTING_KEYS.paymentSubscriptionEnabled,
  topUpEnabled: APP_SETTING_KEYS.paymentTopUpEnabled,
  wechatApiBaseUrl: APP_SETTING_KEYS.paymentWechatApiBaseUrl,
  wechatApiV3Key: APP_SETTING_KEYS.paymentWechatApiV3Key,
  wechatAppId: APP_SETTING_KEYS.paymentWechatAppId,
  wechatEnabled: APP_SETTING_KEYS.paymentWechatEnabled,
  wechatMchId: APP_SETTING_KEYS.paymentWechatMchId,
  wechatMerchantPrivateKey: APP_SETTING_KEYS.paymentWechatMerchantPrivateKey,
  wechatMerchantSerialNo: APP_SETTING_KEYS.paymentWechatMerchantSerialNo,
  wechatPlatformCertificate: APP_SETTING_KEYS.paymentWechatPlatformCertificate,
  wechatPlatformCertificateSerialNo: APP_SETTING_KEYS.paymentWechatPlatformCertificateSerialNo,
  zpayAlipayEnabled: APP_SETTING_KEYS.paymentZpayAlipayEnabled,
  zpayApiBaseUrl: APP_SETTING_KEYS.paymentZpayApiBaseUrl,
  zpayEnabled: APP_SETTING_KEYS.paymentZpayEnabled,
  zpayMerchantId: APP_SETTING_KEYS.paymentZpayMerchantId,
  zpayMerchantKey: APP_SETTING_KEYS.paymentZpayMerchantKey,
  zpayWechatEnabled: APP_SETTING_KEYS.paymentZpayWechatEnabled,
};
