'use client';

import { Alert, toast } from '@lobehub/ui/base-ui';
import { Button, Form, Typography } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { SETTINGS_SUBTITLE } from '@/features/Admin/adminSettingsCopy';
import {
  type AdminSettingsFormValues,
  buildFormValues,
  buildSettingMaterializationUpdates,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
} from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminSettingsGovernanceCard from './AdminSettingsGovernanceCard';
import { AdminFormActions, AdminPageError, AdminPageShell } from './layout';
import SettingsTabs from './Settings/SettingsTabs';

const { Text } = Typography;

const AdminSettingsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('settings'), () =>
    adminCommercialService.getSettingsSection('settings'),
  );
  const { data: storageSettings } = useClientDataSWR(
    ADMIN_SETTINGS_SECTION_SWR_KEY('file-storage'),
    () => adminCommercialService.getSettingsSection('file-storage'),
  );
  const [form] = Form.useForm<AdminSettingsFormValues>();
  const [materializing, setMaterializing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const watchedValues = Form.useWatch([], form) as Partial<AdminSettingsFormValues> | undefined;
  const initialValues = useMemo(() => buildFormValues(data), [data]);
  const pendingUpdates = buildSettingUpdates(watchedValues ?? initialValues, initialValues);
  const hasPendingChanges = pendingUpdates.length > 0;
  const uploadPublicUrlPrefix = storageSettings?.storageS3PublicDomain || undefined;

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(buildFormValues(data));
  }, [data, form]);

  const handleSave = async () => {
    if (!data) return;

    try {
      const values = await form.validateFields();
      const updates = buildSettingUpdates(values, initialValues);

      if (updates.length === 0) {
        toast.info(t('admin.settings.noChanges', '没有需要保存的变更'));
        return;
      }

      setSubmitting(true);
      await adminCommercialService.setAppSettingsBatch({ updates });

      const refreshKeys = getAdminSettingsRefreshKeys(updates);
      for (const key of refreshKeys) {
        await mutate(key);
      }

      toast.success(t('admin.settings.saveSuccess', '设置已保存'));
    } catch {
      toast.error(t('admin.settings.saveFailed', '保存失败，请检查表单内容'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMaterializeDefaults = async () => {
    if (!data) return;

    try {
      const values = await form.validateFields();
      const updates = buildSettingMaterializationUpdates(values);

      setMaterializing(true);
      await adminCommercialService.setAppSettingsBatch({ updates });

      const refreshKeys = getAdminSettingsRefreshKeys(updates);
      for (const key of refreshKeys) {
        await mutate(key);
      }

      toast.success(
        t('admin.settings.materializeDefaultsSuccess', '推荐默认配置已同步到后台设置'),
      );
    } catch {
      toast.error(
        t('admin.settings.materializeDefaultsFailed', '同步失败，请检查表单内容后重试'),
      );
    } finally {
      setMaterializing(false);
    }
  };

  return (
    <AdminPageShell
      description={t('admin.settings.subtitle', SETTINGS_SUBTITLE)}
      title={t('admin.settings.title', '站点基础设置')}
      width="medium"
    >
      <Alert
        showIcon
        type="info"
        message={t(
          'admin.settings.scopeNotice',
          '这里仅维护站点基础展示。默认模型请到“模型与计费矩阵”，文件存储请到“文件存储”，Cron 与记忆任务请到“系统维护”，客户端配置请到“客户端”。',
        )}
      />
      {error ? (
        <AdminPageError
          description={t('admin.settings.loadFailed', '无法读取当前站点设置，请重试。')}
          onRetry={refresh}
        />
      ) : null}

      <AdminSettingsGovernanceCard />

      <Form disabled={isLoading || !data} form={form} layout="vertical">
        <SettingsTabs form={form} uploadPublicUrlPrefix={uploadPublicUrlPrefix} />

        <AdminFormActions label={t('admin.settings.actions', '站点设置操作')}>
          {hasPendingChanges ? (
            <Text type="secondary">有 {pendingUpdates.length} 项待保存</Text>
          ) : null}
          <Button
            disabled={isLoading || !data || submitting}
            loading={materializing}
            onClick={handleMaterializeDefaults}
          >
            {t('admin.settings.materializeDefaults', '同步推荐默认配置')}
          </Button>
          <Button
            disabled={isLoading || !data || !hasPendingChanges || materializing}
            loading={submitting}
            type="primary"
            onClick={handleSave}
          >
            {t('admin.settings.save', '保存设置')}
          </Button>
        </AdminFormActions>
      </Form>
    </AdminPageShell>
  );
});

AdminSettingsPage.displayName = 'AdminSettingsPage';

export default AdminSettingsPage;
