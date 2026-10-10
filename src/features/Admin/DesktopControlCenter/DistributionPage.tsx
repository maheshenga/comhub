'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Alert, Button, Result, Tag, toast } from '@lobehub/ui/base-ui';
import { Descriptions, Empty, Form, Input, Skeleton, Typography } from 'antd';
import { RefreshCw, Save } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeDesktopDownloadUrl } from '@/const/desktopUpdate';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminSettingsConflictAlert from '../shared/AdminSettingsConflictAlert';
import {
  buildDistributionUpdates,
  type DesktopSettingsValues,
  getDesktopSettingsValues,
  isDesktopFormValidationError,
} from './desktopSettingsForm';
import { DistributionDiagnosticsTable } from './distributionDiagnosticsTable';
import { desktopControlCenterStyles } from './styles';
import type { DesktopOverviewResource, DesktopSettingsResource } from './types';
import { useDesktopSettingsFormSync } from './useDesktopSettingsFormSync';

interface DistributionPageProps {
  onDirtyChange?: (dirty: boolean) => void;
  overview: DesktopOverviewResource;
  settings: DesktopSettingsResource;
}

const isAllowedDownloadUrl = (value?: string) => 'url' in normalizeDesktopDownloadUrl(value);

const DistributionPage = memo<DistributionPageProps>(({ onDirtyChange, overview, settings }) => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<DesktopSettingsValues>();
  const [saveError, setSaveError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => getDesktopSettingsValues(settings.data), [settings.data]);
  const { dirtyFields, markEdited, markSaved } = useDesktopSettingsFormSync(
    form,
    Boolean(settings.data),
    initialValues,
    onDirtyChange,
  );

  const diagnosticsContent = overview.isLoading ? (
    <Skeleton active paragraph={{ rows: 6 }} />
  ) : overview.error ? (
    <Result
      status="error"
      title={t('admin.desktopControl.error.title')}
      extra={
        <Button icon={<Icon icon={RefreshCw} size={16} />} onClick={() => void overview.mutate()}>
          {t('admin.desktopControl.retry')}
        </Button>
      }
    />
  ) : !overview.data?.diagnostics.configured ? (
    <Empty
      description={t('admin.desktopControl.unconfigured.title')}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    />
  ) : (
    <DistributionDiagnosticsTable overview={overview} t={t as any} />
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
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
      if (!isDesktopFormValidationError(error)) {
        setSaveError(error);
        if (!(error instanceof Error && error.message === 'APP_SETTINGS_REVISION_CONFLICT')) {
          toast.error(t('admin.desktopUpdate.saveFailed'));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={24}>
      <section className={desktopControlCenterStyles.channelSection}>
        <Typography.Title className={desktopControlCenterStyles.sectionTitle} level={4}>
          {t('admin.desktopControl.tabs.distribution')}
        </Typography.Title>
        {diagnosticsContent}
      </section>

      <section className={desktopControlCenterStyles.formSection}>
        <Typography.Title className={desktopControlCenterStyles.sectionTitle} level={4}>
          {t('admin.desktopControl.downloadSettings')}
        </Typography.Title>
        <AdminSettingsConflictAlert
          error={saveError}
          onReload={async () => {
            await settings.mutate();
            setSaveError(undefined);
          }}
        />
        {settings.error ? (
          <Alert
            message={t('admin.desktopControl.settingsError')}
            type="error"
            action={
              <Button size="small" onClick={() => void settings.mutate()}>
                {t('admin.desktopControl.retry')}
              </Button>
            }
          />
        ) : settings.isLoading && !settings.data ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <Form
            disabled={settings.isLoading || submitting}
            form={form}
            initialValues={initialValues}
            layout="vertical"
            onValuesChange={markEdited}
          >
            <Form.Item
              label={t('admin.desktopUpdate.downloadUrl')}
              name="downloadUrl"
              rules={[
                {
                  validator: (_rule, value: string | undefined) =>
                    isAllowedDownloadUrl(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('admin.desktopControl.downloadUrlInvalid'))),
                },
              ]}
            >
              <Input placeholder="https://downloads.example.com" />
            </Form.Item>
            <Form.Item label={t('admin.desktopUpdate.downloadLabel')} name="downloadLabel">
              <Input placeholder={t('admin.desktopControl.downloadLabelPlaceholder')} />
            </Form.Item>
            <Alert
              showIcon
              description={t('admin.desktopControl.managedByCi.description')}
              message={t('admin.desktopControl.managedByCi')}
              type="info"
            />
            <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label={t('admin.desktopControl.oss.bucket')}>
                {initialValues.ossBucket || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.desktopControl.oss.endpoint')}>
                {initialValues.ossEndpoint || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.desktopControl.oss.credentials')}>
                <Tag color={initialValues.ossCredentialsConfigured ? 'success' : 'default'}>
                  {t(
                    initialValues.ossCredentialsConfigured
                      ? 'admin.desktopControl.oss.configured'
                      : 'admin.desktopControl.oss.notConfigured',
                  )}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.desktopControl.oss.path')}>
                {initialValues.ossPath || '-'}
              </Descriptions.Item>
            </Descriptions>
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
        )}
      </section>
    </Flexbox>
  );
});

DistributionPage.displayName = 'DistributionPage';

export default DistributionPage;
