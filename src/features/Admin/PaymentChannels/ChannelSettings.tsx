'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Alert, Button, Input, Select, Switch, Tabs, Tag, toast } from '@lobehub/ui/base-ui';
import { Form, useForm, useWatch } from '@lobehub/ui/base-ui/form';
import { Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminFormActions, AdminPageError } from '../layout';
import { AdminInlineSkeleton } from '../shared';
import { AlipaySettingsCard, WechatSettingsCard, ZpaySettingsCard } from './ChannelCards';
import {
  buildInitialValues,
  FIELD_KEYS,
  type PaymentFormValues,
  type PaymentSettingsData,
  SECRET_FIELDS,
} from './paymentSettingsShared';

const ChannelSettings = ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => {
  const { t } = useTranslation('subscription');
  const settings = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('payments'), () =>
    adminCommercialService.getSettingsSection('payments'),
  );
  const form = useForm<PaymentFormValues>({
    onValuesChange: () => onDirtyChange(true),
  });
  const [submitting, setSubmitting] = useState(false);
  const data = settings.data as PaymentSettingsData | undefined;
  // Live toggle for the Alipay certificate/public-key inputs, evaluated
  // before save (pre-split AdminPaymentsPage kept the same watch + initial
  // fallback semantics).
  const initialValues = useMemo(() => buildInitialValues(data), [data]);
  const certMode = useWatch(form, 'alipayCertMode') ?? initialValues.alipayCertMode;

  useEffect(() => {
    if (data) {
      form.setValues(initialValues);
      onDirtyChange(false);
    }
  }, [data, form, initialValues, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const save = async () => {
    if (!data) return;
    const { valid } = await form.validate();
    if (!valid) return;
    try {
      const values = form.getValues();
      setSubmitting(true);
      const secretFields = new Set<string>(SECRET_FIELDS);
      const updates = Object.entries(values)
        .filter(([field, value]) => !secretFields.has(field) || String(value ?? '').trim())
        .map(([field, value]) => ({
          key: FIELD_KEYS[field as keyof PaymentFormValues],
          value,
        }));
      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate(ADMIN_SETTINGS_SECTION_SWR_KEY('payments'));
      onDirtyChange(false);
      toast.success(t('admin.payments.saveSuccess', 'Payment settings saved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('admin.payments.saveFailed', 'Save failed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const config = data?.paymentConfig;
  const status = data?.paymentGatewayStatus;
  const legacyEnvironmentKeys = config?.source?.legacyEnvironmentKeys ?? [];
  const formDisabled = settings.isLoading || Boolean(settings.error) || submitting || !data;
  const statusMessage = settings.error
    ? t('admin.payments.loadFailed', 'Unable to load payment settings')
    : !status
      ? t('admin.payments.loading', 'Loading payment status')
      : !status.enabled
        ? t('admin.payments.statusDisabled', 'Unified payments are disabled')
        : !status.configured
          ? t('admin.payments.statusIncomplete', 'No enabled payment method is fully configured')
          : t('admin.payments.statusReady', {
              count: status.methods.length,
              defaultValue: '{{count}} payment methods are available',
            });
  const validateUrl = (value?: string) => {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      const localHttp =
        url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
      if (!url.username && !url.password && (url.protocol === 'https:' || localHttp))
        return undefined;
    } catch {
      // The validation error below is shared by malformed and unsafe URLs.
    }
    return t('admin.payments.urlInvalid', 'Enter a valid HTTPS URL');
  };

  if (settings.isLoading && !settings.data) return <AdminInlineSkeleton rows={8} />;

  return (
    <Flexbox gap={16} style={{ maxWidth: 1040 }}>
      {settings.error ? (
        <AdminPageError description={statusMessage} onRetry={settings.mutate} />
      ) : (
        <Alert
          showIcon
          message={statusMessage}
          type={status?.enabled && status?.configured ? 'success' : 'warning'}
        />
      )}
      {legacyEnvironmentKeys.length > 0 ? (
        <Alert
          showIcon
          type="warning"
          description={
            <Flexbox gap={8}>
              <span>
                {t('admin.payments.legacyEnvironment.description', {
                  count: legacyEnvironmentKeys.length,
                  defaultValue:
                    '{{count}} legacy environment variables are still available as payment configuration fallbacks. Re-enter secret values on this page and save equivalent backend settings before removing them.',
                })}
              </span>
              <Flexbox horizontal gap={6} wrap="wrap">
                {legacyEnvironmentKeys.map((key) => (
                  <Tag key={key}>{key}</Tag>
                ))}
              </Flexbox>
            </Flexbox>
          }
          message={t(
            'admin.payments.legacyEnvironment.title',
            'Payment configuration migration required',
          )}
        />
      ) : null}
      <Alert
        showIcon
        type="info"
        message={t(
          'admin.payments.currencyNotice',
          'Online payments support CNY only. USD packages are neither converted nor offered at checkout.',
        )}
      />

      <Form form={form} layout="vertical">
        <fieldset disabled={formDisabled} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
          <Flexbox gap={16}>
            <Card title={t('admin.payments.general', 'General')}>
              <Flexbox gap={12}>
                <Flexbox horizontal gap={24} wrap="wrap">
                  <Form.Field
                    label={t('admin.payments.enabled', 'Enable unified payments')}
                    name="enabled"
                    valueProp="checked"
                  >
                    <Switch />
                  </Form.Field>
                  <Form.Field
                    label={t('admin.payments.moduleAppEnabled', 'Module purchases')}
                    name="moduleAppEnabled"
                    valueProp="checked"
                  >
                    <Switch />
                  </Form.Field>
                  <Form.Field
                    label={t('admin.payments.subscriptionEnabled', 'Plan subscriptions')}
                    name="subscriptionEnabled"
                    valueProp="checked"
                  >
                    <Switch />
                  </Form.Field>
                  <Form.Field
                    label={t('admin.payments.topUpEnabled', 'Credit top-ups')}
                    name="topUpEnabled"
                    valueProp="checked"
                  >
                    <Switch />
                  </Form.Field>
                </Flexbox>
                <Form.Field
                  label={t('admin.payments.defaultProvider', 'Default provider')}
                  name="defaultProvider"
                >
                  <Select
                    options={[
                      { label: t('admin.payments.provider.alipay', 'Alipay'), value: 'alipay' },
                      {
                        label: t('admin.payments.provider.wechat', 'WeChat Pay'),
                        value: 'wechat_pay',
                      },
                      { label: 'Z-Pay', value: 'zpay' },
                    ]}
                  />
                </Form.Field>
                <Form.Field
                  label={t('admin.payments.publicBaseUrl', 'Public origin')}
                  name="publicBaseUrl"
                  validate={validateUrl}
                  extra={t(
                    'admin.payments.publicBaseUrlHelp',
                    'Used to generate server callback URLs. Production requires a public HTTPS origin.',
                  )}
                >
                  <Input placeholder="https://chat.example.com" />
                </Form.Field>
              </Flexbox>
            </Card>

            <Tabs
              items={[
                {
                  children: (
                    <AlipaySettingsCard
                      certMode={certMode}
                      config={config}
                      t={t}
                      validateUrl={validateUrl}
                    />
                  ),
                  key: 'alipay',
                  label: t('admin.payments.provider.alipay', 'Alipay'),
                },
                {
                  children: <WechatSettingsCard config={config} t={t} validateUrl={validateUrl} />,
                  key: 'wechat',
                  label: t('admin.payments.provider.wechat', 'WeChat Pay'),
                },
                {
                  children: <ZpaySettingsCard config={config} t={t} validateUrl={validateUrl} />,
                  key: 'zpay',
                  label: 'Z-Pay',
                },
              ]}
            />
            <AdminFormActions label={t('admin.payments.actions', '支付渠道配置操作')}>
              <Button
                disabled={formDisabled}
                icon={<Icon icon={Save} size={16} />}
                loading={submitting}
                type="primary"
                onClick={() => void save()}
              >
                {t('admin.payments.save', 'Save payment settings')}
              </Button>
            </AdminFormActions>
          </Flexbox>
        </fieldset>
      </Form>
    </Flexbox>
  );
};

export default ChannelSettings;
