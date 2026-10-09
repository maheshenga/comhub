'use client';

import { Flexbox } from '@lobehub/ui';
import { Select, Switch } from '@lobehub/ui/base-ui';
import { Form, Input, Tag, Typography } from 'antd';

import { Card } from '@/components/antd-compat/Card';

import type { PaymentSettingsData } from './paymentSettingsShared';
import { SecretHint } from './SecretHint';

const { Text } = Typography;

type TFn = (key: string, values?: Record<string, unknown>) => string;

interface ChannelCardProps {
  config: PaymentSettingsData['paymentConfig'];
  t: TFn;
  urlRule: object;
}

export const AlipaySettingsCard = ({ config, t, urlRule }: ChannelCardProps) => {
  const certMode = config?.alipay?.certMode ?? 'public_key';

  return (
    <Card>
      <Flexbox gap={12}>
        <Flexbox horizontal align="center" gap={8}>
          <Form.Item noStyle name="alipayEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Text strong>
            {t('admin.payments.alipay.enabled', 'Enable Alipay website payments')}
          </Text>
          {config?.alipay?.configured && (
            <Tag color="green">{t('admin.payments.configured', 'Configured')}</Tag>
          )}
        </Flexbox>
        <Form.Item label={t('admin.payments.environment', 'Environment')} name="alipayMode">
          <Select
            options={[
              { label: t('admin.payments.sandbox', 'Sandbox'), value: 'sandbox' },
              {
                label: t('admin.payments.production', 'Production'),
                value: 'production',
              },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('admin.payments.alipay.gateway', 'Gateway URL')}
          name="alipayGateway"
          rules={[urlRule]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t('admin.payments.appId', 'App ID')} name="alipayAppId">
          <Input />
        </Form.Item>
        <Form.Item label={t('admin.payments.alipay.sellerId', 'Seller ID')} name="alipaySellerId">
          <Input />
        </Form.Item>
        <Form.Item
          label={t('admin.payments.alipay.certMode', 'Verification mode')}
          name="alipayCertMode"
        >
          <Select
            options={[
              {
                label: t('admin.payments.alipay.publicKeyMode', 'Alipay public key'),
                value: 'public_key',
              },
              {
                label: t('admin.payments.alipay.certificateMode', 'Certificate'),
                value: 'certificate',
              },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('admin.payments.alipay.privateKey', 'Application private key')}
          name="alipayMerchantPrivateKey"
          extra={
            <SecretHint
              configured={config?.alipay?.merchantPrivateKeyConfigured}
              masked={config?.alipay?.merchantPrivateKeyMasked}
            />
          }
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
        </Form.Item>
        {certMode === 'certificate' ? (
          <>
            <Form.Item
              name="alipayCertificate"
              extra={
                <SecretHint
                  configured={config?.alipay?.certificateConfigured}
                  masked={config?.alipay?.certificateMasked}
                />
              }
              label={t(
                'admin.payments.alipay.certificate',
                'Alipay public-key certificate',
              )}
            >
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
            </Form.Item>
            <Form.Item
              name="alipayAppCertSn"
              label={t(
                'admin.payments.alipay.appCertSn',
                'Application certificate serial number',
              )}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="alipayRootCertSn"
              label={t(
                'admin.payments.alipay.rootCertSn',
                'Alipay root certificate serial number',
              )}
            >
              <Input />
            </Form.Item>
          </>
        ) : (
          <Form.Item
            label={t('admin.payments.alipay.publicKey', 'Alipay public key')}
            name="alipayPublicKey"
            extra={
              <SecretHint
                configured={config?.alipay?.publicKeyConfigured}
                masked={config?.alipay?.publicKeyMasked}
              />
            }
          >
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>
        )}
      </Flexbox>
    </Card>
  );
};

export const WechatSettingsCard = ({ config, t, urlRule }: ChannelCardProps) => (
  <Card>
    <Flexbox gap={12}>
      <Flexbox horizontal align="center" gap={8}>
        <Form.Item noStyle name="wechatEnabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Text strong>
          {t('admin.payments.wechat.enabled', 'Enable WeChat Native Pay')}
        </Text>
        {config?.wechat?.configured && (
          <Tag color="green">{t('admin.payments.configured', 'Configured')}</Tag>
        )}
      </Flexbox>
      <Form.Item label={t('admin.payments.appId', 'App ID')} name="wechatAppId">
        <Input />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.wechat.mchId', 'Merchant ID')}
        name="wechatMchId"
      >
        <Input />
      </Form.Item>
      <Form.Item
        name="wechatMerchantSerialNo"
        label={t(
          'admin.payments.wechat.serialNo',
          'Merchant certificate serial number',
        )}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.apiBaseUrl', 'API base URL')}
        name="wechatApiBaseUrl"
        rules={[urlRule]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.wechat.privateKey', 'Merchant API private key')}
        name="wechatMerchantPrivateKey"
        extra={
          <SecretHint
            configured={config?.wechat?.merchantPrivateKeyConfigured}
            masked={config?.wechat?.merchantPrivateKeyMasked}
          />
        }
      >
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.wechat.apiV3Key', 'API v3 key (32 bytes)')}
        name="wechatApiV3Key"
        extra={
          <SecretHint
            configured={config?.wechat?.apiV3KeyConfigured}
            masked={config?.wechat?.apiV3KeyMasked}
          />
        }
      >
        <Input.Password />
      </Form.Item>
      <Form.Item
        name="wechatPlatformCertificate"
        extra={
          <SecretHint
            configured={config?.wechat?.platformCertificateConfigured}
            masked={config?.wechat?.platformCertificateMasked}
          />
        }
        label={t(
          'admin.payments.wechat.platformCertificate',
          'WeChat Pay platform certificate',
        )}
      >
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
      </Form.Item>
      <Form.Item
        name="wechatPlatformCertificateSerialNo"
        label={t(
          'admin.payments.wechat.platformCertificateSerialNo',
          'WeChat Pay platform certificate serial number',
        )}
      >
        <Input />
      </Form.Item>
    </Flexbox>
  </Card>
);

export const ZpaySettingsCard = ({ config, t, urlRule }: ChannelCardProps) => (
  <Card>
    <Flexbox gap={12}>
      <Flexbox horizontal align="center" gap={8}>
        <Form.Item noStyle name="zpayEnabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Text strong>{t('admin.payments.zpay.enabled', 'Enable Z-Pay')}</Text>
        {config?.zpay?.configured && (
          <Tag color="green">{t('admin.payments.configured', 'Configured')}</Tag>
        )}
      </Flexbox>
      <Form.Item
        label={t('admin.payments.apiBaseUrl', 'API base URL')}
        name="zpayApiBaseUrl"
        rules={[urlRule]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.zpay.merchantId', 'Merchant ID (pid)')}
        name="zpayMerchantId"
      >
        <Input />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.zpay.merchantKey', 'Merchant key')}
        name="zpayMerchantKey"
        extra={
          <SecretHint
            configured={config?.zpay?.merchantKeyConfigured}
            masked={config?.zpay?.merchantKeyMasked}
          />
        }
      >
        <Input.Password />
      </Form.Item>
      <Flexbox horizontal gap={24}>
        <Form.Item
          label={t('admin.payments.zpay.alipay', 'Alipay sub-channel')}
          name="zpayAlipayEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={t('admin.payments.zpay.wechat', 'WeChat sub-channel')}
          name="zpayWechatEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Flexbox>
    </Flexbox>
  </Card>
);
