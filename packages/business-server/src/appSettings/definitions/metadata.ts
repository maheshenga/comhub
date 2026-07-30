import { APP_SETTING_KEYS, type AppSettingKey } from '@/const/appSettingsRegistry';

import type { AppSettingLifecycle } from '../types';

type SourceMetadata = {
  defaultSource: string;
  effectiveSource: string[];
};

const databaseSource = (key: AppSettingKey) => `database:${key}`;
const environmentSource = (name: string) => `environment:${name}`;

const environmentFallback = (
  key: AppSettingKey,
  environmentNames: string[],
  includeApplicationDefault = false,
): SourceMetadata => ({
  defaultSource: environmentSource(environmentNames[0]),
  effectiveSource: [
    databaseSource(key),
    ...environmentNames.map(environmentSource),
    ...(includeApplicationDefault ? ['application-default'] : []),
  ],
});

const PAYMENT_ENVIRONMENT_FALLBACKS: Partial<Record<AppSettingKey, string[]>> = {
  [APP_SETTING_KEYS.paymentAlipayAppCertSn]: [
    'PAYMENT_ALIPAY_APP_CERT_SN',
    'MODULE_APP_ALIPAY_APP_CERT_SN',
  ],
  [APP_SETTING_KEYS.paymentAlipayAppId]: ['PAYMENT_ALIPAY_APP_ID', 'MODULE_APP_ALIPAY_APP_ID'],
  [APP_SETTING_KEYS.paymentAlipayCertMode]: [
    'PAYMENT_ALIPAY_CERT_MODE',
    'MODULE_APP_ALIPAY_CERT_MODE',
  ],
  [APP_SETTING_KEYS.paymentAlipayCertificate]: [
    'PAYMENT_ALIPAY_CERTIFICATE',
    'MODULE_APP_ALIPAY_CERTIFICATE',
  ],
  [APP_SETTING_KEYS.paymentAlipayEnabled]: ['PAYMENT_ALIPAY_ENABLED', 'MODULE_APP_ALIPAY_ENABLED'],
  [APP_SETTING_KEYS.paymentAlipayGateway]: ['PAYMENT_ALIPAY_GATEWAY', 'MODULE_APP_ALIPAY_GATEWAY'],
  [APP_SETTING_KEYS.paymentAlipayMerchantPrivateKey]: [
    'PAYMENT_ALIPAY_MERCHANT_PRIVATE_KEY',
    'MODULE_APP_ALIPAY_MERCHANT_PRIVATE_KEY',
  ],
  [APP_SETTING_KEYS.paymentAlipayMode]: ['PAYMENT_ALIPAY_MODE', 'MODULE_APP_ALIPAY_MODE'],
  [APP_SETTING_KEYS.paymentAlipayPublicKey]: [
    'PAYMENT_ALIPAY_PUBLIC_KEY',
    'MODULE_APP_ALIPAY_PUBLIC_KEY',
  ],
  [APP_SETTING_KEYS.paymentAlipayRootCertSn]: [
    'PAYMENT_ALIPAY_ROOT_CERT_SN',
    'MODULE_APP_ALIPAY_ROOT_CERT_SN',
  ],
  [APP_SETTING_KEYS.paymentAlipaySellerId]: [
    'PAYMENT_ALIPAY_SELLER_ID',
    'MODULE_APP_ALIPAY_SELLER_ID',
  ],
  [APP_SETTING_KEYS.paymentDefaultProvider]: ['PAYMENT_DEFAULT_PROVIDER'],
  [APP_SETTING_KEYS.paymentEnabled]: ['PAYMENT_ENABLED', 'MODULE_APP_ALIPAY_ENABLED'],
  [APP_SETTING_KEYS.paymentModuleAppEnabled]: [
    'PAYMENT_MODULE_APP_ENABLED',
    'MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED',
  ],
  [APP_SETTING_KEYS.paymentPublicBaseUrl]: [
    'PAYMENT_PUBLIC_BASE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'MODULE_APP_ALIPAY_NOTIFY_URL',
    'MODULE_APP_ALIPAY_RETURN_URL',
  ],
  [APP_SETTING_KEYS.paymentSubscriptionEnabled]: ['PAYMENT_SUBSCRIPTION_ENABLED'],
  [APP_SETTING_KEYS.paymentTopUpEnabled]: ['PAYMENT_TOP_UP_ENABLED'],
  [APP_SETTING_KEYS.paymentWechatApiBaseUrl]: ['PAYMENT_WECHAT_API_BASE_URL'],
  [APP_SETTING_KEYS.paymentWechatApiV3Key]: ['PAYMENT_WECHAT_API_V3_KEY'],
  [APP_SETTING_KEYS.paymentWechatAppId]: ['PAYMENT_WECHAT_APP_ID'],
  [APP_SETTING_KEYS.paymentWechatEnabled]: ['PAYMENT_WECHAT_ENABLED'],
  [APP_SETTING_KEYS.paymentWechatMchId]: ['PAYMENT_WECHAT_MCH_ID'],
  [APP_SETTING_KEYS.paymentWechatMerchantPrivateKey]: ['PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY'],
  [APP_SETTING_KEYS.paymentWechatMerchantSerialNo]: ['PAYMENT_WECHAT_MERCHANT_SERIAL_NO'],
  [APP_SETTING_KEYS.paymentWechatPlatformCertificate]: ['PAYMENT_WECHAT_PLATFORM_CERTIFICATE'],
  [APP_SETTING_KEYS.paymentWechatPlatformCertificateSerialNo]: [
    'PAYMENT_WECHAT_PLATFORM_CERTIFICATE_SERIAL_NO',
  ],
  [APP_SETTING_KEYS.paymentZpayAlipayEnabled]: ['PAYMENT_ZPAY_ALIPAY_ENABLED'],
  [APP_SETTING_KEYS.paymentZpayApiBaseUrl]: ['PAYMENT_ZPAY_API_BASE_URL'],
  [APP_SETTING_KEYS.paymentZpayEnabled]: ['PAYMENT_ZPAY_ENABLED'],
  [APP_SETTING_KEYS.paymentZpayMerchantId]: ['PAYMENT_ZPAY_MERCHANT_ID'],
  [APP_SETTING_KEYS.paymentZpayMerchantKey]: ['PAYMENT_ZPAY_MERCHANT_KEY'],
  [APP_SETTING_KEYS.paymentZpayWechatEnabled]: ['PAYMENT_ZPAY_WECHAT_ENABLED'],
};

const SOURCE_OVERRIDES: Partial<Record<AppSettingKey, SourceMetadata>> = {
  [APP_SETTING_KEYS.composioApiKey]: environmentFallback(APP_SETTING_KEYS.composioApiKey, [
    'COMPOSIO_API_KEY',
  ]),
  [APP_SETTING_KEYS.composioAuthConfigIds]: environmentFallback(
    APP_SETTING_KEYS.composioAuthConfigIds,
    ['COMPOSIO_AUTH_CONFIG_IDS'],
  ),
  [APP_SETTING_KEYS.composioEnabled]: {
    defaultSource: 'derived:composio.apiKey-or-application-default',
    effectiveSource: [
      databaseSource(APP_SETTING_KEYS.composioEnabled),
      environmentSource('COMPOSIO_ENABLED'),
      databaseSource(APP_SETTING_KEYS.composioApiKey),
      environmentSource('COMPOSIO_API_KEY'),
      'application-default',
    ],
  },
  [APP_SETTING_KEYS.cronSecret]: environmentFallback(APP_SETTING_KEYS.cronSecret, ['CRON_SECRET']),
  [APP_SETTING_KEYS.memoryUserMemoryTriggerMode]: {
    defaultSource: 'application-default',
    effectiveSource: [
      environmentSource('MEMORY_USER_MEMORY_TRIGGER_MODE'),
      databaseSource(APP_SETTING_KEYS.memoryUserMemoryTriggerMode),
      'application-default',
    ],
  },
  [APP_SETTING_KEYS.storageS3AccessKeyId]: environmentFallback(
    APP_SETTING_KEYS.storageS3AccessKeyId,
    ['S3_ACCESS_KEY_ID'],
  ),
  [APP_SETTING_KEYS.storageS3Bucket]: environmentFallback(APP_SETTING_KEYS.storageS3Bucket, [
    'S3_BUCKET',
  ]),
  [APP_SETTING_KEYS.storageS3EnablePathStyle]: environmentFallback(
    APP_SETTING_KEYS.storageS3EnablePathStyle,
    ['S3_ENABLE_PATH_STYLE'],
    true,
  ),
  [APP_SETTING_KEYS.storageS3Endpoint]: environmentFallback(APP_SETTING_KEYS.storageS3Endpoint, [
    'S3_ENDPOINT',
  ]),
  [APP_SETTING_KEYS.storageS3FilePath]: environmentFallback(
    APP_SETTING_KEYS.storageS3FilePath,
    ['NEXT_PUBLIC_S3_FILE_PATH'],
    true,
  ),
  [APP_SETTING_KEYS.storageS3PreviewUrlExpireIn]: environmentFallback(
    APP_SETTING_KEYS.storageS3PreviewUrlExpireIn,
    ['S3_PREVIEW_URL_EXPIRE_IN'],
    true,
  ),
  [APP_SETTING_KEYS.storageS3PublicDomain]: environmentFallback(
    APP_SETTING_KEYS.storageS3PublicDomain,
    ['S3_PUBLIC_DOMAIN', 'NEXT_PUBLIC_S3_DOMAIN'],
  ),
  [APP_SETTING_KEYS.storageS3Region]: environmentFallback(APP_SETTING_KEYS.storageS3Region, [
    'S3_REGION',
  ]),
  [APP_SETTING_KEYS.storageS3SecretAccessKey]: environmentFallback(
    APP_SETTING_KEYS.storageS3SecretAccessKey,
    ['S3_SECRET_ACCESS_KEY'],
  ),
  [APP_SETTING_KEYS.storageS3SetAcl]: environmentFallback(
    APP_SETTING_KEYS.storageS3SetAcl,
    ['S3_SET_ACL'],
    true,
  ),
};

export const getAppSettingSourceMetadata = (
  key: AppSettingKey,
  lifecycle: AppSettingLifecycle,
): SourceMetadata => {
  if (lifecycle === 'external') {
    return {
      defaultSource: 'external:CI/GitHub Secrets',
      effectiveSource: ['external:CI/GitHub Secrets'],
    };
  }

  if (lifecycle === 'deprecated') {
    return {
      defaultSource: 'application-default',
      effectiveSource: ['application-default'],
    };
  }

  const paymentEnvironmentNames = PAYMENT_ENVIRONMENT_FALLBACKS[key];
  if (paymentEnvironmentNames) {
    return environmentFallback(key, paymentEnvironmentNames, true);
  }

  return (
    SOURCE_OVERRIDES[key] ?? {
      defaultSource: 'application-default',
      effectiveSource: [databaseSource(key), 'application-default'],
    }
  );
};
