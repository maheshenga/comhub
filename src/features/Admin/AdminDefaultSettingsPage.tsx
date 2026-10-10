'use client';

import { Flexbox } from '@lobehub/ui';
import { toast } from '@lobehub/ui/base-ui';
import { Form } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ADMIN_SETTINGS_SECTION_SWR_KEY,
  PROFILE_INTEREST_AREAS_SWR_KEY,
  PROFILE_OPTIONS_SWR_KEY,
  RUNTIME_CONFIG_SWR_KEY,
  USER_STATE_SWR_KEY,
} from '@/const/adminCacheKeys';
import { buildModelOptions } from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import {
  adminCommercialService,
  AdminSettingsRevisionConflictError,
} from '@/services/adminCommercial';

import {
  IntegrationFields,
  RuntimeFields,
  UserDefaultsFields,
} from './DefaultSettings/SectionFields';
import type { AdminDefaultSettingsScope,DefaultSettingsData, FormValues } from './DefaultSettings/shared';
import { DEFAULTS_INITIAL_VALUES, RUNTIME_SAVE_ERROR_MESSAGES, scopeCopy } from './DefaultSettings/shared';
import SyncActionButtons from './DefaultSettings/SyncActionButtons';
import {
  applyIntegrationsToForm,
  applyRuntimeToForm,
  applyUserDefaultsToForm,
  buildIntegrationUpdates,
  buildRuntimeUpdates,
  buildUserDefaultsUpdates,
} from './DefaultSettings/updates';
import { AdminPageError, AdminPageShell } from './layout';
import AdminSettingsConflictAlert from './shared/AdminSettingsConflictAlert';

export type { AdminDefaultSettingsScope };

const AdminDefaultSettingsPage = memo<{ scope: AdminDefaultSettingsScope }>(({ scope }) => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<FormValues>();
  const [saveError, setSaveError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY(scope), () =>
    adminCommercialService.getSettingsSection(scope),
  );
  const { data: storageSettings } = useClientDataSWR(
    scope === 'user-defaults' ? ADMIN_SETTINGS_SECTION_SWR_KEY('file-storage') : null,
    () => adminCommercialService.getSettingsSection('file-storage'),
  );
  const settings = data as DefaultSettingsData | undefined;
  const uploadPublicUrlPrefix = storageSettings?.storageS3PublicDomain || undefined;
  const modelOptions = useMemo(
    () =>
      buildModelOptions({
        enabledNewapiModels: settings?.sharedHealth?.enabledNewapiModels as any,
        modelType: 'chat',
      }),
    [settings?.sharedHealth?.enabledNewapiModels],
  );
  const embeddingModelOptions = useMemo(
    () =>
      buildModelOptions({
        enabledNewapiModels: settings?.sharedHealth?.enabledNewapiModels as any,
        modelType: 'embedding',
      }),
    [settings?.sharedHealth?.enabledNewapiModels],
  );
  const rerankerModelOptions = useMemo(
    () =>
      buildModelOptions({
        enabledNewapiModels: settings?.sharedHealth?.enabledNewapiModels as any,
      }),
    [settings?.sharedHealth?.enabledNewapiModels],
  );

  useEffect(() => {
    if (!settings) return;

    if (scope === 'ai-runtime-defaults') {
      form.setFieldsValue(applyRuntimeToForm(settings));
      return;
    }

    if (scope === 'integrations') {
      form.setFieldsValue(applyIntegrationsToForm(settings));
      return;
    }

    form.setFieldsValue(applyUserDefaultsToForm(settings, modelOptions));
  }, [form, modelOptions, scope, settings]);

  const handleSave = async (syncMode?: 'runtime-memory' | 'user-defaults') => {
    if (!data) return;

    setSubmitting(true);
    if (syncMode) setSyncing(true);
    setSaveError(undefined);

    try {
      const values = await form.validateFields();
      const updates =
        scope === 'ai-runtime-defaults'
          ? buildRuntimeUpdates(values, {
              chatOptions: modelOptions,
              embeddingOptions: embeddingModelOptions,
              rerankerOptions: rerankerModelOptions,
            })
          : scope === 'integrations'
            ? buildIntegrationUpdates(values)
            : buildUserDefaultsUpdates(values);

      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate(ADMIN_SETTINGS_SECTION_SWR_KEY(scope));

      if (scope === 'ai-runtime-defaults') {
        await mutate(RUNTIME_CONFIG_SWR_KEY);
        if (syncMode === 'runtime-memory') {
          try {
            const result = await adminCommercialService.syncRuntimeMemoryModelsToUsers();
            await mutate(USER_STATE_SWR_KEY);
            const skipped = result.skippedFields.length;
            if (skipped > 0) {
              toast.warning(
                t('admin.defaultSettings.aiRuntime.savedAndSyncedWithSkipped', {
                  fields: result.syncedFields.length,
                  skipped,
                  users: result.syncedUsers,
                }),
              );
            } else {
              toast.success(
                t('admin.defaultSettings.aiRuntime.savedAndSynced', {
                  fields: result.syncedFields.length,
                  users: result.syncedUsers,
                }),
              );
            }
          } catch {
            toast.warning(t('admin.defaultSettings.aiRuntime.savedSyncFailed'));
          }
          return;
        }
        toast.success(t('admin.defaultSettings.aiRuntime.saved'));
        return;
      }

      if (scope === 'integrations') {
        toast.success(t('admin.defaultSettings.integrations.saved'));
        return;
      }

      await Promise.all([
        mutate(PROFILE_INTEREST_AREAS_SWR_KEY),
        mutate(PROFILE_OPTIONS_SWR_KEY),
        mutate(RUNTIME_CONFIG_SWR_KEY),
      ]);
      if (syncMode === 'user-defaults') {
        try {
          const result = await adminCommercialService.syncUserGlobalSettingsDefaultsToUsers({
            forceDefaultAgentMeta: true,
          });
          await mutate(USER_STATE_SWR_KEY);
          toast.success(
            t('admin.defaultSettings.userDefaults.savedAndSynced', {
              fields: result.syncedFields.length,
              users: result.syncedUsers,
            }),
          );
        } catch {
          toast.warning(t('admin.defaultSettings.userDefaults.savedSyncFailed'));
        }
        return;
      }
      toast.success(t('admin.defaultSettings.userDefaults.saved'));
    } catch (error) {
      if (error instanceof AdminSettingsRevisionConflictError) {
        setSaveError(error);
      } else if (error instanceof SyntaxError) {
        toast.error(t('admin.defaultSettings.invalidJson'));
      } else {
        const errorMessage = error instanceof Error ? error.message : '';
        toast.error(
          RUNTIME_SAVE_ERROR_MESSAGES[errorMessage] ?? t('admin.defaultSettings.saveFailed'),
        );
      }
    } finally {
      setSubmitting(false);
      setSyncing(false);
    }
  };

  return (
    <AdminPageShell
      description={t(scopeCopy[scope].descriptionKey, scopeCopy[scope].description)}
      title={t(scopeCopy[scope].titleKey, scopeCopy[scope].title)}
      width="large"
    >
      {error ? (
        <AdminPageError
          description={t('admin.defaultSettings.loadFailed', '无法读取当前默认设置，请重试。')}
          onRetry={refresh}
        />
      ) : null}
      <AdminSettingsConflictAlert
        error={saveError}
        onReload={async () => {
          await refresh();
          setSaveError(undefined);
        }}
      />
      <Form
        disabled={isLoading || !data}
        form={form}
        initialValues={DEFAULTS_INITIAL_VALUES}
        layout="vertical"
      >
        <Flexbox gap={24}>
          {scope === 'ai-runtime-defaults' ? (
            <RuntimeFields
              embeddingModelOptions={embeddingModelOptions}
              form={form}
              modelOptions={modelOptions}
              rerankerModelOptions={rerankerModelOptions}
            />
          ) : scope === 'integrations' ? (
            <IntegrationFields settings={settings} />
          ) : (
            <UserDefaultsFields
              form={form}
              modelOptions={modelOptions}
              uploadPublicUrlPrefix={uploadPublicUrlPrefix}
            />
          )}
          <SyncActionButtons
            disabled={isLoading || !data || syncing}
            handleSave={handleSave}
            scope={scope}
            submitting={submitting}
            syncing={syncing}
            t={t as any}
          />
        </Flexbox>
      </Form>
    </AdminPageShell>
  );
});

AdminDefaultSettingsPage.displayName = 'AdminDefaultSettingsPage';

export default AdminDefaultSettingsPage;
