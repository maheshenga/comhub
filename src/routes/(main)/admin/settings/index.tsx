'use client';

import { AutoComplete, Button, Divider, Form, Input, InputNumber, Modal, Space, message } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const SETTING_KEYS = {
  brandFaviconUrl: 'brand.faviconUrl',
  brandLogoUrl: 'brand.logoUrl',
  brandName: 'brand.name',
  brandPrimaryColor: 'brand.primaryColor',
  brandSlogan: 'brand.slogan',
  cronAuditRetentionDays: 'cron.auditRetentionDays',
  cronPendingOrderExpiryDays: 'cron.pendingOrderExpiryDays',
  cronSecret: 'cron.secret',
  defaultAgentModel: 'defaultAgent.model',
  newapiApiKey: 'newapi.apiKey',
  newapiEnabledModels: 'newapi.enabledModels',
  newapiProxyUrl: 'newapi.proxyUrl',
  referralRewardCredits: 'referral.rewardCredits',
} as const;

const SWR_KEY = ['admin-settings'];
const URL_SPLIT_REGEX = /[\r\n,;；，]+/;

type AdminSettingsData = Awaited<ReturnType<typeof adminCommercialService.getAllSettings>>;

type AdminSettingsFormValues = {
  brandFaviconUrl: string;
  brandLogoUrl: string;
  brandName: string;
  brandPrimaryColor: string;
  brandSlogan: string;
  cronAuditRetentionDays: number;
  cronPendingOrderExpiryDays: number;
  cronSecret: string;
  defaultAgentModel: string;
  newapiApiKey: string;
  newapiEnabledModels: string;
  newapiProxyUrl: string;
  referralRewardCredits: number;
};

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseGatewayUrls = (value: unknown) =>
  (typeof value === 'string' ? value.split(URL_SPLIT_REGEX) : [])
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeGatewayUrl = (value: string) => value.replace(/\/+$/, '');

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const summarizeGatewayUrls = (value: unknown) => {
  const entries = parseGatewayUrls(value);
  const uniqueUrls = Array.from(new Set(entries.map(normalizeGatewayUrl)));
  const invalidUrls = uniqueUrls.filter((item) => !isValidHttpUrl(item));

  return {
    entryCount: entries.length,
    invalidUrls,
    normalizedValue: uniqueUrls.join('\n'),
    uniqueCount: uniqueUrls.length,
  };
};

const summarizeModelIds = (value: unknown) => {
  const entries = (typeof value === 'string' ? value.split(URL_SPLIT_REGEX) : [])
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueModelIds = Array.from(new Set(entries));

  return {
    entryCount: entries.length,
    normalizedValue: uniqueModelIds.join('\n'),
    uniqueCount: uniqueModelIds.length,
  };
};

const buildFormValues = (data?: AdminSettingsData): AdminSettingsFormValues => ({
  brandFaviconUrl: data?.brandFaviconUrl ?? '',
  brandLogoUrl: data?.brandLogoUrl ?? '',
  brandName: data?.brandName ?? '',
  brandPrimaryColor: data?.brandPrimaryColor ?? '',
  brandSlogan: data?.brandSlogan ?? '',
  cronAuditRetentionDays: data?.cronAuditRetentionDays ?? 365,
  cronPendingOrderExpiryDays: data?.cronPendingOrderExpiryDays ?? 7,
  cronSecret: '',
  defaultAgentModel: data?.defaultAgentModel ?? '',
  newapiApiKey: '',
  newapiEnabledModels: data?.newapiEnabledModels ?? '',
  newapiProxyUrl: data?.newapiProxyUrl ?? '',
  referralRewardCredits: data?.referralRewardCredits ?? 0,
});

const normalizeFormValues = (values: Partial<AdminSettingsFormValues>): AdminSettingsFormValues => ({
  brandFaviconUrl: normalizeText(values.brandFaviconUrl),
  brandLogoUrl: normalizeText(values.brandLogoUrl),
  brandName: normalizeText(values.brandName),
  brandPrimaryColor: normalizeText(values.brandPrimaryColor),
  brandSlogan: normalizeText(values.brandSlogan),
  cronAuditRetentionDays:
    typeof values.cronAuditRetentionDays === 'number' ? values.cronAuditRetentionDays : 365,
  cronPendingOrderExpiryDays:
    typeof values.cronPendingOrderExpiryDays === 'number' ? values.cronPendingOrderExpiryDays : 7,
  cronSecret: normalizeText(values.cronSecret),
  defaultAgentModel: normalizeText(values.defaultAgentModel),
  newapiApiKey: normalizeText(values.newapiApiKey),
  newapiEnabledModels: summarizeModelIds(values.newapiEnabledModels).normalizedValue,
  newapiProxyUrl: summarizeGatewayUrls(values.newapiProxyUrl).normalizedValue,
  referralRewardCredits:
    typeof values.referralRewardCredits === 'number' ? values.referralRewardCredits : 0,
});

const buildSettingUpdates = (
  currentValues: Partial<AdminSettingsFormValues>,
  initialValues: AdminSettingsFormValues,
) => {
  const current = normalizeFormValues(currentValues);
  const initial = normalizeFormValues(initialValues);
  const updates: { key: string; value: unknown }[] = [];

  if (current.newapiApiKey) {
    updates.push({ key: SETTING_KEYS.newapiApiKey, value: current.newapiApiKey });
  }

  if (current.cronSecret) {
    updates.push({ key: SETTING_KEYS.cronSecret, value: current.cronSecret });
  }

  if (current.newapiProxyUrl !== initial.newapiProxyUrl) {
    updates.push({ key: SETTING_KEYS.newapiProxyUrl, value: current.newapiProxyUrl });
  }

  if (current.newapiEnabledModels !== initial.newapiEnabledModels) {
    updates.push({ key: SETTING_KEYS.newapiEnabledModels, value: current.newapiEnabledModels });
  }

  if (current.defaultAgentModel !== initial.defaultAgentModel) {
    updates.push({ key: SETTING_KEYS.defaultAgentModel, value: current.defaultAgentModel });
  }

  if (current.referralRewardCredits !== initial.referralRewardCredits) {
    updates.push({
      key: SETTING_KEYS.referralRewardCredits,
      value: current.referralRewardCredits,
    });
  }

  if (current.cronAuditRetentionDays !== initial.cronAuditRetentionDays) {
    updates.push({
      key: SETTING_KEYS.cronAuditRetentionDays,
      value: current.cronAuditRetentionDays,
    });
  }

  if (current.cronPendingOrderExpiryDays !== initial.cronPendingOrderExpiryDays) {
    updates.push({
      key: SETTING_KEYS.cronPendingOrderExpiryDays,
      value: current.cronPendingOrderExpiryDays,
    });
  }

  if (current.brandName !== initial.brandName) {
    updates.push({ key: SETTING_KEYS.brandName, value: current.brandName });
  }

  if (current.brandLogoUrl !== initial.brandLogoUrl) {
    updates.push({ key: SETTING_KEYS.brandLogoUrl, value: current.brandLogoUrl });
  }

  if (current.brandFaviconUrl !== initial.brandFaviconUrl) {
    updates.push({ key: SETTING_KEYS.brandFaviconUrl, value: current.brandFaviconUrl });
  }

  if (current.brandPrimaryColor !== initial.brandPrimaryColor) {
    updates.push({ key: SETTING_KEYS.brandPrimaryColor, value: current.brandPrimaryColor });
  }

  if (current.brandSlogan !== initial.brandSlogan) {
    updates.push({ key: SETTING_KEYS.brandSlogan, value: current.brandSlogan });
  }

  return updates;
};

const AdminSettingsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const watchedValues = Form.useWatch([], form) as Partial<AdminSettingsFormValues> | undefined;
  const watchedNewapiEnabledModels = Form.useWatch('newapiEnabledModels', form);
  const watchedNewapiProxyUrl = Form.useWatch('newapiProxyUrl', form);
  const [runResult, setRunResult] = useState<{
    auditCutoff?: string;
    auditLogsDeleted?: number;
    pendingOrdersCutoff?: string;
    pendingOrdersExpired?: number;
  } | null>(null);
  const initialValues = buildFormValues(data);
  const pendingUpdates = buildSettingUpdates(watchedValues ?? initialValues, initialValues);
  const hasPendingChanges = pendingUpdates.length > 0;
  const modelIdSummary = summarizeModelIds(watchedNewapiEnabledModels);
  const gatewayUrlSummary = summarizeGatewayUrls(watchedNewapiProxyUrl);
  const defaultModelOptions =
    data?.defaultModelSuggestions?.map((value) => ({ label: value, value })) ?? [];

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const r = await adminCommercialService.runMaintenance();
      setRunResult(r);
      message.success(t('admin.settings.runSuccess', 'Maintenance executed'));
    } catch {
      message.error(t('admin.settings.runFailed', 'Maintenance failed'));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(buildFormValues(data));
  }, [data, form]);

  const handleNormalizeGatewayUrls = () => {
    const normalizedValue = summarizeGatewayUrls(form.getFieldValue('newapiProxyUrl')).normalizedValue;
    form.setFieldValue('newapiProxyUrl', normalizedValue);
  };

  const handleNormalizeModelIds = () => {
    const normalizedValue = summarizeModelIds(form.getFieldValue('newapiEnabledModels')).normalizedValue;
    form.setFieldValue('newapiEnabledModels', normalizedValue);
  };

  const handleTrimDefaultModel = () => {
    form.setFieldValue('defaultAgentModel', normalizeText(form.getFieldValue('defaultAgentModel')));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates = buildSettingUpdates(values, initialValues);

      if (updates.length === 0) {
        message.info(t('admin.settings.noChanges', 'No changes to save'));
        return;
      }

      setSubmitting(true);
      await Promise.all(updates.map((update) => adminCommercialService.setAppSetting(update)));
      message.success(t('admin.settings.saveSuccess', 'Settings saved'));
      form.setFieldValue('newapiApiKey', '');
      form.setFieldValue('cronSecret', '');
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.settings.saveFailed', 'Save failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 720 }}>
      <Form disabled={isLoading} form={form} layout="vertical">
        <Divider plain>{t('admin.settings.brandSection', 'Brand')}</Divider>
        <Form.Item
          extra={t('admin.settings.brandName.help', 'Replaces the “LobeHub” brand name across the app.')}
          label={t('admin.settings.brandName', 'Brand Name')}
          name="brandName"
        >
          <Input placeholder="LobeHub" />
        </Form.Item>
        <Form.Item label={t('admin.settings.brandSlogan', 'Brand Slogan')} name="brandSlogan">
          <Input placeholder={t('admin.settings.brandSlogan.placeholder', 'Optional tagline')} />
        </Form.Item>
        <Form.Item label={t('admin.settings.brandLogoUrl', 'Logo URL')} name="brandLogoUrl">
          <Input placeholder="https://.../logo.svg" />
        </Form.Item>
        <Form.Item label={t('admin.settings.brandFaviconUrl', 'Favicon URL')} name="brandFaviconUrl">
          <Input placeholder="https://.../favicon.ico" />
        </Form.Item>
        <Form.Item
          extra={t('admin.settings.brandPrimary.help', 'Hex color e.g. #1677ff (theme accent override)')}
          label={t('admin.settings.brandPrimaryColor', 'Primary Color')}
          name="brandPrimaryColor"
        >
          <Input placeholder="#1677ff" />
        </Form.Item>

        <Divider plain>{t('admin.settings.gatewaySection', 'NewAPI Gateway')}</Divider>
        <Form.Item
          extra={t(
            'admin.settings.defaultModel.help',
            'Used as the backend default model for new users and newly created inbox agents. Suggestions come from the global NewAPI model list configured below, and you can still type any model ID supported by your gateway.',
          )}
          label={t('admin.settings.defaultModel', 'Default Model')}
          name="defaultAgentModel"
        >
          <AutoComplete
            filterOption={(inputValue, option) =>
              option?.value?.toLowerCase().includes(inputValue.toLowerCase()) ?? false
            }
            options={defaultModelOptions}
          >
            <Input
              allowClear
              onBlur={handleTrimDefaultModel}
              placeholder="gpt-4o-mini"
            />
          </AutoComplete>
        </Form.Item>
        <Form.Item
          extra={
            <Flexbox gap={4}>
              <div>
                {t(
                  'admin.settings.newapiModels.help',
                  'Global NewAPI chat model list used for default-model suggestions and backend-managed model choices. Enter one chat model ID per line.',
                )}
              </div>
              {modelIdSummary.uniqueCount > 0 && (
                <div>
                  {modelIdSummary.entryCount === modelIdSummary.uniqueCount
                    ? t('admin.settings.newapiModels.summary', {
                        count: modelIdSummary.uniqueCount,
                        defaultValue: '{{count}} model IDs ready to use.',
                      })
                    : t('admin.settings.newapiModels.deduped', {
                        count: modelIdSummary.uniqueCount,
                        defaultValue:
                          '{{raw}} entries detected, normalized to {{count}} unique model IDs.',
                        raw: modelIdSummary.entryCount,
                      })}
                </div>
              )}
            </Flexbox>
          }
          label={t('admin.settings.newapiModels', 'NewAPI Chat Model IDs')}
          name="newapiEnabledModels"
        >
          <Input.TextArea
            onBlur={handleNormalizeModelIds}
            placeholder={'gpt-4o-mini\ngpt-4.1\nclaude-3.7-sonnet'}
            rows={5}
          />
        </Form.Item>
        <Form.Item
          extra={
            data?.newapiApiKeyMasked
              ? `${t('admin.settings.current', 'Current')}: ${data.newapiApiKeyMasked}`
              : t('admin.settings.notSet', 'Not configured')
          }
          label={t('admin.settings.newapiKey', 'NewAPI API Key')}
          name="newapiApiKey"
        >
          <Input.Password
            placeholder={t('admin.settings.leaveBlank', 'Leave blank to keep current')}
          />
        </Form.Item>
        <Form.Item
          extra={
            <Flexbox gap={4}>
              <div>
                {t(
                  'admin.settings.newapiUrl.help',
                  'Supports multiple addresses. Enter one URL per line and requests will rotate across them, with automatic failover if one becomes unavailable.',
                )}
              </div>
              {gatewayUrlSummary.uniqueCount > 0 && (
                <div>
                  {gatewayUrlSummary.entryCount === gatewayUrlSummary.uniqueCount
                    ? t('admin.settings.newapiUrl.summary', {
                        count: gatewayUrlSummary.uniqueCount,
                        defaultValue: '{{count}} addresses ready to use.',
                      })
                    : t('admin.settings.newapiUrl.deduped', {
                        count: gatewayUrlSummary.uniqueCount,
                        defaultValue:
                          '{{raw}} entries detected, normalized to {{count}} unique addresses.',
                        raw: gatewayUrlSummary.entryCount,
                      })}
                </div>
              )}
              {gatewayUrlSummary.invalidUrls.length > 0 && (
                <div style={{ color: '#d4380d' }}>
                  {t('admin.settings.newapiUrl.invalid', {
                    count: gatewayUrlSummary.invalidUrls.length,
                    defaultValue:
                      '{{count}} address format issue(s) detected. Please use a full http(s) URL.',
                  })}
                </div>
              )}
            </Flexbox>
          }
          label={t('admin.settings.newapiUrl', 'NewAPI Proxy URL')}
          name="newapiProxyUrl"
          rules={[
            {
              validator: async (_, value) => {
                if (summarizeGatewayUrls(value).invalidUrls.length === 0) return;

                throw new Error(
                  t('admin.settings.newapiUrl.invalid', {
                    count: summarizeGatewayUrls(value).invalidUrls.length,
                    defaultValue:
                      '{{count}} address format issue(s) detected. Please use a full http(s) URL.',
                  }),
                );
              },
            },
          ]}
        >
          <Input.TextArea
            onBlur={handleNormalizeGatewayUrls}
            placeholder={'https://ai-1.example.com/v1\nhttps://ai-2.example.com/v1'}
            rows={4}
          />
        </Form.Item>
        <Form.Item
          label={t('admin.settings.referralReward', 'Referral Reward Credits')}
          name="referralRewardCredits"
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <Divider plain>
          {t('admin.settings.cronSection', 'Maintenance Cron')}
        </Divider>

        <Form.Item
          extra={
            data?.cronSecretConfigured
              ? `${t('admin.settings.current', 'Current')}: ${data.cronSecretMasked}`
              : t('admin.settings.notSet', 'Not configured')
          }
          label={t('admin.settings.cronSecret', 'Cron Bearer Secret')}
          name="cronSecret"
        >
          <Input.Password
            placeholder={t('admin.settings.leaveBlank', 'Leave blank to keep current')}
          />
        </Form.Item>
        <Form.Item
          extra={t(
            'admin.settings.auditRetention.help',
            'Admin audit logs older than this are deleted (7..3650).',
          )}
          label={t('admin.settings.auditRetention', 'Audit Log Retention (days)')}
          name="cronAuditRetentionDays"
        >
          <InputNumber max={3650} min={7} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          extra={t(
            'admin.settings.pendingOrderExpiry.help',
            'Pending top-up orders older than this are auto-expired (1..365).',
          )}
          label={t('admin.settings.pendingOrderExpiry', 'Pending Order Expiry (days)')}
          name="cronPendingOrderExpiryDays"
        >
          <InputNumber max={365} min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Space>
          <Button disabled={!hasPendingChanges} loading={submitting} onClick={handleSave} type="primary">
            {t('admin.settings.save', 'Save')}
          </Button>
          <Button loading={running} onClick={handleRunNow}>
            {t('admin.settings.runNow', 'Run Maintenance Now')}
          </Button>
        </Space>
      </Form>

      <Modal
        footer={null}
        onCancel={() => setRunResult(null)}
        open={!!runResult}
        title={t('admin.settings.runResult', 'Maintenance Result')}
      >
        <pre style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap' }}>
          {runResult ? JSON.stringify(runResult, null, 2) : ''}
        </pre>
      </Modal>
    </Flexbox>
  );
});

AdminSettingsPage.displayName = 'AdminSettingsPage';

export default AdminSettingsPage;
