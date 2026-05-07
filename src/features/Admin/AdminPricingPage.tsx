'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Form, Input, InputNumber, message, Switch } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const SETTING_KEYS = {
  ordersEnabled: 'orders.management.enabled',
  pricingMultiplier: 'pricing.creditMultiplier',
  pricingRules: 'pricing.modelRules',
} as const;

const SWR_KEY = ['admin-settings'];

type PricingRule = {
  creditsPerDollar?: number;
  model?: string;
  multiplier?: number;
  provider?: string;
};

type FormValues = {
  ordersEnabled: boolean;
  pricingMultiplier: number;
  pricingRulesText: string;
};

const exampleRules: PricingRule[] = [
  { model: 'gpt-4o-mini', multiplier: 0.8, provider: 'openai' },
  { creditsPerDollar: 1_000_000, model: 'deepseek-chat', provider: 'newapi' },
  { model: '*', multiplier: 1.2, provider: 'anthropic' },
];

const parseRules = (value: string): PricingRule[] => {
  if (!value.trim()) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('rules must be array');

  return parsed.map((item) => ({
    creditsPerDollar:
      Number.isFinite(Number(item.creditsPerDollar)) && Number(item.creditsPerDollar) > 0
        ? Number(item.creditsPerDollar)
        : undefined,
    model: typeof item.model === 'string' ? item.model.trim() : undefined,
    multiplier:
      Number.isFinite(Number(item.multiplier)) && Number(item.multiplier) >= 0
        ? Number(item.multiplier)
        : undefined,
    provider: typeof item.provider === 'string' ? item.provider.trim() : undefined,
  }));
};

const AdminPricingPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      ordersEnabled: data.ordersManagementEnabled ?? true,
      pricingMultiplier: data.pricingCreditMultiplier ?? 1,
      pricingRulesText: JSON.stringify(data.pricingModelRules ?? [], null, 2),
    });
  }, [data, form]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const rules = parseRules(values.pricingRulesText);
      await Promise.all([
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.pricingMultiplier,
          value: values.pricingMultiplier,
        }),
        adminCommercialService.setAppSetting({ key: SETTING_KEYS.pricingRules, value: rules }),
        adminCommercialService.setAppSetting({
          key: SETTING_KEYS.ordersEnabled,
          value: Boolean(values.ordersEnabled),
        }),
      ]);
      message.success(t('admin.pricing.saveSuccess', '计费规则已保存'));
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.pricing.saveFailed', '保存失败，请检查计费规则 JSON 配置。'));
    } finally {
      setSubmitting(false);
    }
  };

  const fillExample = () => {
    form.setFieldValue('pricingRulesText', JSON.stringify(exampleRules, null, 2));
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 760 }}>
      <Alert
        showIcon
        type="info"
        message={t(
          'admin.pricing.tip',
          '计费规则用于按 provider/model 调整积分消耗；model 目前只支持精确模型 ID 或 "*"，creditsPerDollar 可覆盖美元到积分的换算。',
        )}
      />
      <Form
        disabled={isLoading}
        form={form}
        initialValues={{ ordersEnabled: true, pricingMultiplier: 1, pricingRulesText: '[]' }}
        layout="vertical"
      >
        <Form.Item label={t('admin.pricing.multiplier', '全局积分倍率')} name="pricingMultiplier">
          <InputNumber min={0} precision={4} step={0.1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label={t('admin.pricing.rules', '模型计费规则')}
          name="pricingRulesText"
          extra={t(
            'admin.pricing.rules.help',
            'JSON 数组。每一项可包含 provider、model、multiplier、creditsPerDollar。',
          )}
          rules={[
            {
              validator: async (_, value) => {
                parseRules(value || '');
              },
            },
          ]}
        >
          <Input.TextArea rows={12} />
        </Form.Item>
        <Form.Item
          label={t('admin.pricing.ordersEnabled', '启用订单管理')}
          name="ordersEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Flexbox horizontal gap={8}>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            {t('admin.settings.save', '保存')}
          </Button>
          <Button onClick={fillExample}>{t('admin.pricing.example', '填入示例')}</Button>
        </Flexbox>
      </Form>
    </Flexbox>
  );
});

AdminPricingPage.displayName = 'AdminPricingPage';

export default AdminPricingPage;
