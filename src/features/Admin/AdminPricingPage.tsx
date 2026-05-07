'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Form, InputNumber, message, Switch, Typography } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ADMIN_BASE_PATH } from '@/features/Admin/adminNavigation';
import {
  type AdminPricingSettingsFormValues,
  buildPricingSettingUpdates,
} from '@/features/Admin/adminPricingSettings';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const SWR_KEY = ['admin-settings'];

const AdminPricingPage = memo(() => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();
  const [form] = Form.useForm<AdminPricingSettingsFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading } = useClientDataSWR(SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );

  useEffect(() => {
    if (!data) return;

    form.setFieldsValue({
      ordersEnabled: data.ordersManagementEnabled ?? true,
      pricingMultiplier: data.pricingCreditMultiplier ?? 1,
    });
  }, [data, form]);

  const handleSave = async () => {
    setSubmitting(true);

    try {
      const values = await form.validateFields();
      await Promise.all(
        buildPricingSettingUpdates(values).map((update) =>
          adminCommercialService.setAppSetting(update),
        ),
      );
      message.success(t('admin.pricing.saveSuccess', '全局计费设置已保存'));
      await mutate(SWR_KEY);
    } catch {
      message.error(t('admin.pricing.saveFailed', '保存全局计费设置失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 760 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.pricing.title', '全局计费设置')}
        </Title>
        <Text type="secondary">
          {t(
            'admin.pricing.subtitle',
            '这里只保留影响全站的计费开关。模型级倍率、套餐权限和默认模型统一在“模型与计费矩阵”维护。',
          )}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        type="info"
        action={
          <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/model-billing-matrix`)}>
            打开矩阵
          </Button>
        }
        message={t(
          'admin.pricing.tip',
          '模型级计费规则已迁移到矩阵页面，避免同一规则在多个入口被覆盖。当前页面保存全局积分倍率和订单管理开关。',
        )}
      />

      <Form
        disabled={isLoading}
        form={form}
        initialValues={{ ordersEnabled: true, pricingMultiplier: 1 }}
        layout="vertical"
      >
        <Form.Item label={t('admin.pricing.multiplier', '全局积分倍率')} name="pricingMultiplier">
          <InputNumber min={0} precision={4} step={0.1} style={{ width: '100%' }} />
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
        </Flexbox>
      </Form>
    </Flexbox>
  );
});

AdminPricingPage.displayName = 'AdminPricingPage';

export default AdminPricingPage;
