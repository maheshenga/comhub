'use client';

import { Alert, Button, Icon, Input, Text, TextArea, toast } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { Save } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminCommercialService } from '@/services/adminCommercial';

import { DESKTOP_DEFAULT_BUSINESS_SERVER_URL } from '../adminDesktopUpdateSettings';
import { AdminPageError } from '../layout';
import { AdminInlineSkeleton } from '../shared';
import AdminSettingsConflictAlert from '../shared/AdminSettingsConflictAlert';
import { buildBrandUpdates, getDesktopSettingsValues } from './desktopSettingsForm';
import { desktopControlCenterStyles } from './styles';
import type { DesktopSettingsResource } from './types';
import { useDesktopSettingsFormSync } from './useDesktopSettingsFormSync';

interface BrandPageProps {
  onDirtyChange?: (dirty: boolean) => void;
  settings: DesktopSettingsResource;
}

const BrandPage = memo<BrandPageProps>(({ onDirtyChange, settings }) => {
  const { t } = useTranslation('subscription');
  const [saveError, setSaveError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => getDesktopSettingsValues(settings.data), [settings.data]);
  const { dirtyFields, form, markSaved } = useDesktopSettingsFormSync({
    hasData: Boolean(settings.data),
    initialValues,
    onDirtyChange,
  });

  const handleSave = async () => {
    const { valid } = await form.validate();
    if (!valid) return;

    try {
      const values = form.getValues();
      const updates = buildBrandUpdates(initialValues, values, dirtyFields);
      if (updates.length === 0) {
        toast.info(t('admin.desktopUpdate.noChanges'));
        return;
      }
      setSubmitting(true);
      setSaveError(undefined);
      await adminCommercialService.setAppSettingsBatch({ updates });
      markSaved();
      toast.success(t('admin.desktopUpdate.saveSuccess'));
    } catch (error) {
      setSaveError(error);
      if (!(error instanceof Error && error.message === 'APP_SETTINGS_REVISION_CONFLICT')) {
        toast.error(t('admin.desktopUpdate.saveFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (settings.error) {
    return (
      <AdminPageError
        retryLabel={t('admin.desktopControl.retry')}
        title={t('admin.desktopControl.settingsError')}
        onRetry={() => void settings.mutate()}
      />
    );
  }

  if (settings.isLoading && !settings.data) return <AdminInlineSkeleton rows={6} />;

  return (
    <section className={desktopControlCenterStyles.formSection}>
      <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
        {t('admin.desktopControl.tabs.brand')}
      </Text>
      <AdminSettingsConflictAlert
        error={saveError}
        onReload={async () => {
          await settings.mutate();
          setSaveError(undefined);
        }}
      />
      <Alert
        showIcon
        description={<Text code>{DESKTOP_DEFAULT_BUSINESS_SERVER_URL}</Text>}
        message={t('admin.desktopControl.businessServer')}
        type="info"
      />
      <fieldset
        disabled={settings.isLoading || submitting}
        style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Field label={t('admin.desktopUpdate.loginWindowTitle')} name="loginWindowTitle">
            <Input placeholder="ComHub" />
          </Form.Field>
          <Form.Field
            extra={t('admin.desktopUpdate.loginLogoUrl.help')}
            label={t('admin.desktopUpdate.loginLogoUrl')}
            name="loginLogoUrl"
          >
            <Input placeholder="/images/brand/logo.png" />
          </Form.Field>
          <Form.Field label={t('admin.desktopUpdate.loginTitle')} name="loginTitle">
            <Input />
          </Form.Field>
          <Form.Field label={t('admin.desktopUpdate.loginDescription')} name="loginDescription">
            <TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
          </Form.Field>
          <Form.Field
            label={t('admin.desktopUpdate.loginCloudButtonLabel')}
            name="loginCloudButtonLabel"
          >
            <Input />
          </Form.Field>
          <Form.Field label={t('admin.desktopUpdate.loginFooterText')} name="loginFooterText">
            <Input />
          </Form.Field>

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
      </fieldset>
    </section>
  );
});

BrandPage.displayName = 'BrandPage';

export default BrandPage;
