'use client';

import { Button, Flexbox, Input } from '@lobehub/ui';
import { App, Divider, Form, Input as AntdInput, Spin, Typography } from 'antd';
import { SaveIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

interface SiteConfigRow {
  encrypted: boolean;
  key: string;
  updatedAt: Date | null;
  updatedBy: string | null;
  value: string | null;
}

/** Editable site-config keys shown in the form, in display order. */
const EDITABLE_KEYS = [
  'brand_name',
  'brand_logo_url',
  'site_title',
  'site_description',
  'official_url',
  'custom_footer',
  'support_email',
] as const;

const AdminSettings = memo(() => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load all config rows from the admin endpoint
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const rows: SiteConfigRow[] = await lambdaClient.siteConfig.getAll.query();
      const values: Record<string, string> = {};
      for (const row of rows) {
        if ((EDITABLE_KEYS as readonly string[]).includes(row.key)) {
          values[row.key] = row.value ?? '';
        }
      }
      form.setFieldsValue(values);
    } catch (error) {
      message.error(t('admin.loadError'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [form, message, t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const entries = EDITABLE_KEYS.map((key) => ({
        key,
        value: values[key]?.trim() || null,
      }));
      await lambdaClient.siteConfig.bulkSet.mutate({ entries });
      message.success(t('admin.saveSuccess'));
    } catch (error) {
      message.error(t('admin.saveError'));
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingHeader
        extra={
          <Button
            icon={SaveIcon}
            loading={saving}
            type={'primary'}
            onClick={handleSave}
          >
            {t('admin.save')}
          </Button>
        }
        title={t('admin.title')}
      />
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" style={{ maxWidth: 600, paddingBlockStart: 24 }}>
          <Typography.Title level={5}>{t('admin.branding.title')}</Typography.Title>
          <Form.Item label={t('admin.branding.brandName')} name="brand_name">
            <Input placeholder="LobeHub" />
          </Form.Item>
          <Form.Item label={t('admin.branding.brandLogoUrl')} name="brand_logo_url">
            <Input placeholder="https://example.com/logo.png" />
          </Form.Item>
          <Divider />
          <Typography.Title level={5}>{t('admin.site.title')}</Typography.Title>
          <Form.Item label={t('admin.site.siteTitle')} name="site_title">
            <Input placeholder={t('admin.site.siteTitlePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('admin.site.siteDescription')} name="site_description">
            <AntdInput.TextArea
              autoSize={{ maxRows: 4, minRows: 2 }}
              placeholder={t('admin.site.siteDescriptionPlaceholder')}
            />
          </Form.Item>
          <Form.Item label={t('admin.site.officialUrl')} name="official_url">
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Divider />
          <Typography.Title level={5}>{t('admin.other.title')}</Typography.Title>
          <Form.Item label={t('admin.other.customFooter')} name="custom_footer">
            <AntdInput.TextArea
              autoSize={{ maxRows: 4, minRows: 2 }}
              placeholder={t('admin.other.customFooterPlaceholder')}
            />
          </Form.Item>
          <Form.Item label={t('admin.other.supportEmail')} name="support_email">
            <Input placeholder="support@example.com" type="email" />
          </Form.Item>
        </Form>
      </Spin>
    </>
  );
});

export default AdminSettings;
