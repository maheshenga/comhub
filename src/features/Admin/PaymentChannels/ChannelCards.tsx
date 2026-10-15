'use client';

import { Flexbox } from '@lobehub/ui';
import { Input, InputPassword, Select, Switch, Tag, Text, TextArea } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form } from 'antd';
import type { TFunction } from 'i18next';

import { Card } from '@/components/antd-compat/Card';

import type { PaymentFormValues, PaymentSettingsData } from './paymentSettingsShared';
import { SecretHint } from './SecretHint';


interface ChannelCardProps {
  config: PaymentSettingsData['paymentConfig'];
  t: TFunction<'subscription'>;
  urlRule: object;
}

interface AlipaySettingsCardProps extends ChannelCardProps {
  // Live form value of alipayCertMode (Form.useWatch in ChannelSettings): the
  // certificate/public-key inputs must toggle immediately on select change,
  // before save — same semantics as the pre-split AdminPaymentsPage.
  certMode: PaymentFormValues['alipayCertMode'];
}

export const AlipaySettingsCard = ({ certMode, config, t, urlRule }: AlipaySettingsCardProps) => {
  return (
    <Card>
      <Flexbox gap={12}>
        <Flexbox horizontal align="center" gap={8}>
          <Form.Item noStyle name="alipayEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Text strong>{t('admin.payments.alipay.enabled', 'Enable Alipay website payments')}</Text>
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
          <TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
        </Form.Item>
        {certMode === 'certificate' ? (
          <>
            <Form.Item
              label={t('admin.payments.alipay.certificate', 'Alipay public-key certificate')}
              name="alipayCertificate"
              extra={
                <SecretHint
                  configured={config?.alipay?.certificateConfigured}
                  masked={config?.alipay?.certificateMasked}
                />
              }
            >
              <TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
            </Form.Item>
            <Form.Item
              label={t('admin.payments.alipay.appCertSn', 'Application certificate serial number')}
              name="alipayAppCertSn"
            >
              <Input />
            </Form.Item>
            <Form.Item
              label={t('admin.payments.alipay.rootCertSn', 'Alipay root certificate serial number')}
              name="alipayRootCertSn"
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
            <TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
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
        <Text strong>{t('admin.payments.wechat.enabled', 'Enable WeChat Native Pay')}</Text>
        {config?.wechat?.configured && (
          <Tag color="green">{t('admin.payments.configured', 'Configured')}</Tag>
        )}
      </Flexbox>
      <Form.Item label={t('admin.payments.appId', 'App ID')} name="wechatAppId">
        <Input />
      </Form.Item>
      <Form.Item label={t('admin.payments.wechat.mchId', 'Merchant ID')} name="wechatMchId">
        <Input />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.wechat.serialNo', 'Merchant certificate serial number')}
        name="wechatMerchantSerialNo"
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
        <TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
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
        <InputPassword />
      </Form.Item>
      <Form.Item
        label={t('admin.payments.wechat.platformCertificate', 'WeChat Pay platform certificate')}
        name="wechatPlatformCertificate"
        extra={
          <SecretHint
            configured={config?.wechat?.platformCertificateConfigured}
            masked={config?.wechat?.platformCertificateMasked}
          />
        }
      >
        <TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
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
        <InputPassword />
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
