'use client';

import { Alert, Button, Descriptions, Flexbox, Icon, Input, Tag, Text, toast } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { Save } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeDesktopDownloadUrl } from '@/const/desktopUpdate';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageError } from '../layout';
import { AdminInlineSkeleton, AdminPageState } from '../shared';
import AdminSettingsConflictAlert from '../shared/AdminSettingsConflictAlert';
import { buildDistributionUpdates, getDesktopSettingsValues } from './desktopSettingsForm';
import { DistributionDiagnosticsTable } from './distributionDiagnosticsTable';
import { desktopControlCenterStyles } from './styles';
import type { DesktopOverviewResource, DesktopSettingsResource } from './types';
import { useDesktopSettingsFormSync } from './useDesktopSettingsFormSync';

interface DistributionPageProps {
  onConfigure?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  overview: DesktopOverviewResource;
  settings: DesktopSettingsResource;
}

const isAllowedDownloadUrl = (value?: string) => 'url' in normalizeDesktopDownloadUrl(value);

const DistributionPage = memo<DistributionPageProps>((props) => {
  const { onConfigure, onDirtyChange, overview, settings } = props;
  const { t } = useTranslation('subscription');
  const [saveError, setSaveError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => getDesktopSettingsValues(settings.data), [settings.data]);
  const { dirtyFields, form, markSaved } = useDesktopSettingsFormSync({
    hasData: Boolean(settings.data),
    initialValues,
    onDirtyChange,
  });

  const diagnosticsContent = (
    <AdminPageState
      emptyDescription={t('admin.desktopControl.unconfigured.description')}
      emptyTitle={t('admin.desktopControl.unconfigured.title')}
      error={overview.error}
      errorTitle={t('admin.desktopControl.error.title')}
      isEmpty={!overview.isLoading && !overview.error && !overview.data?.diagnostics.configured}
      loading={overview.isLoading}
      retryLabel={t('admin.desktopControl.retry')}
      skeletonVariant="list"
      primaryAction={
        onConfigure
          ? { label: t('admin.desktopControl.configure'), onClick: onConfigure }
          : undefined
      }
      onRetry={() => void overview.mutate()}
    >
      <DistributionDiagnosticsTable overview={overview} t={t as any} />
    </AdminPageState>
  );

  const handleSave = async () => {
    const { valid } = await form.validate();
    if (!valid) return;

    try {
      const values = form.getValues();
      const updates = buildDistributionUpdates(initialValues, values, dirtyFields);
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

  return (
    <Flexbox gap={24}>
      <section className={desktopControlCenterStyles.channelSection}>
        <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
          {t('admin.desktopControl.tabs.distribution')}
        </Text>
        {diagnosticsContent}
      </section>

      <section className={desktopControlCenterStyles.formSection}>
        <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
          {t('admin.desktopControl.downloadSettings')}
        </Text>
        <AdminSettingsConflictAlert
          error={saveError}
          onReload={async () => {
            await settings.mutate();
            setSaveError(undefined);
          }}
        />
        {settings.error ? (
          <AdminPageError
            retryLabel={t('admin.desktopControl.retry')}
            title={t('admin.desktopControl.settingsError')}
            onRetry={() => void settings.mutate()}
          />
        ) : settings.isLoading && !settings.data ? (
          <AdminInlineSkeleton rows={4} />
        ) : (
          <fieldset
            disabled={settings.isLoading || submitting}
            style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
          >
            <Form form={form} layout="vertical">
              <Form.Field
                label={t('admin.desktopUpdate.downloadUrl')}
                name="downloadUrl"
                validate={(value) =>
                  isAllowedDownloadUrl(value as string | undefined)
                    ? undefined
                    : t('admin.desktopControl.downloadUrlInvalid')
                }
              >
                <Input placeholder="https://downloads.example.com" />
              </Form.Field>
              <Form.Field label={t('admin.desktopUpdate.downloadLabel')} name="downloadLabel">
                <Input placeholder={t('admin.desktopControl.downloadLabelPlaceholder')} />
              </Form.Field>
              <Alert
                showIcon
                description={t('admin.desktopControl.managedByCi.description')}
                message={t('admin.desktopControl.managedByCi')}
                type="info"
              />
              <Descriptions
                bordered
                column={1}
                style={{ marginTop: 16 }}
                items={[
                  {
                    children: initialValues.ossBucket || '-',
                    key: 'bucket',
                    label: t('admin.desktopControl.oss.bucket'),
                  },
                  {
                    children: initialValues.ossEndpoint || '-',
                    key: 'endpoint',
                    label: t('admin.desktopControl.oss.endpoint'),
                  },
                  {
                    children: (
                      <Tag color={initialValues.ossCredentialsConfigured ? 'success' : 'default'}>
                        {t(
                          initialValues.ossCredentialsConfigured
                            ? 'admin.desktopControl.oss.configured'
                            : 'admin.desktopControl.oss.notConfigured',
                        )}
                      </Tag>
                    ),
                    key: 'credentials',
                    label: t('admin.desktopControl.oss.credentials'),
                  },
                  {
                    children: initialValues.ossPath || '-',
                    key: 'path',
                    label: t('admin.desktopControl.oss.path'),
                  },
                ]}
              />
              <div className={desktopControlCenterStyles.formActions}>
                <Button
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
        )}
      </section>
    </Flexbox>
  );
});

DistributionPage.displayName = 'DistributionPage';

export default DistributionPage;
