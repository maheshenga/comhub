'use client';

import {
  Button,
  Icon,
  Input,
  InputNumber,
  Segmented,
  Switch,
  Text,
  TextArea,
  toast,
} from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { Save } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeDesktopUpdateServerUrl } from '@/const/desktopUpdate';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageError } from '../layout';
import { AdminInlineSkeleton } from '../shared';
import AdminSettingsConflictAlert from '../shared/AdminSettingsConflictAlert';
import { buildUpdateSettingsUpdates, getDesktopSettingsValues } from './desktopSettingsForm';
import { desktopControlCenterStyles } from './styles';
import type { DesktopSettingsResource } from './types';
import { useDesktopSettingsFormSync } from './useDesktopSettingsFormSync';

const isAllowedUpdateServerUrl = (value?: string) => {
  return 'url' in normalizeDesktopUpdateServerUrl(value);
};

interface UpdateSettingsPageProps {
  onDirtyChange?: (dirty: boolean) => void;
  settings: DesktopSettingsResource;
}

const UpdateSettingsPage = memo<UpdateSettingsPageProps>(({ onDirtyChange, settings }) => {
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
      const updates = buildUpdateSettingsUpdates(initialValues, values, dirtyFields);
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
        {t('admin.desktopControl.tabs.updates')}
      </Text>
      <AdminSettingsConflictAlert
        error={saveError}
        onReload={async () => {
          await settings.mutate();
          setSaveError(undefined);
        }}
      />
      <fieldset
        disabled={settings.isLoading || submitting}
        style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
      >
        <Form form={form} layout="vertical">
          <Form.Field
            extra={t('admin.desktopUpdate.serverUrl.help')}
            label={t('admin.desktopUpdate.serverUrl')}
            name="serverUrl"
            validate={(value) =>
              isAllowedUpdateServerUrl(value as string | undefined)
                ? undefined
                : t('admin.desktopControl.serverUrlInvalid')
            }
          >
            <Input placeholder="https://releases.example.com" />
          </Form.Field>

          <Form.Field label={t('admin.desktopUpdate.channel')} name="channel">
            <Segmented
              block
              options={[
                { label: t('admin.desktopControl.status.stable'), value: 'stable' },
                { label: t('admin.desktopControl.status.canary'), value: 'canary' },
              ]}
            />
          </Form.Field>

          <Form.Field
            label={t('admin.desktopUpdate.autoCheck')}
            name="autoCheck"
            valueProp="checked"
          >
            <Switch />
          </Form.Field>

          <Form.Field
            extra={t('admin.desktopUpdate.checkInterval.help')}
            label={t('admin.desktopUpdate.checkInterval')}
            name="checkInterval"
            validate={(value) => {
              const interval = Number(value);
              return interval >= 1 && interval <= 1440
                ? undefined
                : t('admin.desktopUpdate.checkInterval.range');
            }}
          >
            <InputNumber max={1440} min={1} style={{ width: '100%' }} />
          </Form.Field>

          <Form.Field
            extra={t('admin.desktopUpdate.currentVersion.help')}
            label={t('admin.desktopUpdate.currentVersion')}
            name="currentVersion"
          >
            <Input placeholder="2.3.0" />
          </Form.Field>

          <Form.Field
            extra={t('admin.desktopUpdate.releaseNotes.help')}
            label={t('admin.desktopUpdate.releaseNotes')}
            name="releaseNotes"
          >
            <TextArea autoSize={{ maxRows: 10, minRows: 5 }} />
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

UpdateSettingsPage.displayName = 'UpdateSettingsPage';

export default UpdateSettingsPage;
