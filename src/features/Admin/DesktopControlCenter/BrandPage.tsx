'use client';

import { Icon } from '@lobehub/ui';
import { Alert, Button, Form, Input, message, Skeleton, Typography } from 'antd';
import { RefreshCw, Save } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminCommercialService } from '@/services/adminCommercial';

import { DESKTOP_DEFAULT_BUSINESS_SERVER_URL } from '../adminDesktopUpdateSettings';
import {
  buildBrandUpdates,
  getDesktopSettingsValues,
  isDesktopFormValidationError,
  type DesktopSettingsValues,
} from './desktopSettingsForm';
import { desktopControlCenterStyles } from './styles';
import type { DesktopSettingsResource } from './types';
import { useDesktopSettingsFormSync } from './useDesktopSettingsFormSync';

interface BrandPageProps {
  settings: DesktopSettingsResource;
}

const BrandPage = memo<BrandPageProps>(({ settings }) => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<DesktopSettingsValues>();
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => getDesktopSettingsValues(settings.data), [settings.data]);
  const { dirtyFields, markEdited, markSaved } = useDesktopSettingsFormSync(
    form,
    Boolean(settings.data),
    initialValues,
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates = buildBrandUpdates(initialValues, values, dirtyFields);
      if (updates.length === 0) {
        message.info(t('admin.desktopUpdate.noChanges'));
        return;
      }
      setSubmitting(true);
      await adminCommercialService.setAppSettingsBatch({ updates });
      markSaved();
      message.success(t('admin.desktopUpdate.saveSuccess'));
    } catch (error) {
      if (!isDesktopFormValidationError(error)) {
        message.error(t('admin.desktopUpdate.saveFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (settings.error) {
    return (
      <Alert
        action={
          <Button icon={<Icon icon={RefreshCw} size={16} />} onClick={() => void settings.mutate()}>
            {t('admin.desktopControl.retry')}
          </Button>
        }
        message={t('admin.desktopControl.settingsError')}
        type="error"
      />
    );
  }

  if (settings.isLoading && !settings.data) return <Skeleton active paragraph={{ rows: 6 }} />;

  return (
    <section className={desktopControlCenterStyles.formSection}>
      <Typography.Title className={desktopControlCenterStyles.sectionTitle} level={4}>
        {t('admin.desktopControl.tabs.brand')}
      </Typography.Title>
      <Alert
        description={<Typography.Text code>{DESKTOP_DEFAULT_BUSINESS_SERVER_URL}</Typography.Text>}
        message={t('admin.desktopControl.businessServer')}
        showIcon
        type="info"
      />
      <Form
        disabled={settings.isLoading || submitting}
        form={form}
        initialValues={initialValues}
        layout="vertical"
        onValuesChange={markEdited}
        style={{ marginTop: 16 }}
      >
        <Form.Item label={t('admin.desktopUpdate.loginWindowTitle')} name="loginWindowTitle">
          <Input placeholder="ComHub" />
        </Form.Item>
        <Form.Item
          extra={t('admin.desktopUpdate.loginLogoUrl.help')}
          label={t('admin.desktopUpdate.loginLogoUrl')}
          name="loginLogoUrl"
        >
          <Input placeholder="/images/brand/logo.png" />
        </Form.Item>
        <Form.Item label={t('admin.desktopUpdate.loginTitle')} name="loginTitle">
          <Input />
        </Form.Item>
        <Form.Item label={t('admin.desktopUpdate.loginDescription')} name="loginDescription">
          <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
        </Form.Item>
        <Form.Item
          label={t('admin.desktopUpdate.loginCloudButtonLabel')}
          name="loginCloudButtonLabel"
        >
          <Input />
        </Form.Item>
        <Form.Item label={t('admin.desktopUpdate.loginFooterText')} name="loginFooterText">
          <Input />
        </Form.Item>

        <div className={desktopControlCenterStyles.formActions}>
          <Button
            disabled={settings.isLoading}
            icon={<Icon icon={Save} size={16} />}
            loading={submitting}
            type="primary"
            onClick={() => void handleSave()}
          >
            {t('admin.desktopUpdate.save')}
          </Button>
        </div>
      </Form>
    </section>
  );
});

BrandPage.displayName = 'BrandPage';

export default BrandPage;
