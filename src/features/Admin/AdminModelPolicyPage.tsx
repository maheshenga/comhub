'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Form, message } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { GLOBAL_MODEL_POLICY_DENIED_MESSAGE } from '@/features/Admin/adminModelPolicySettings';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import {
  AdminFormActions,
  AdminPageError,
  AdminPageShell,
} from './layout';
import { type FormValues, normalizeListText,SETTING_KEYS } from './ModelPolicy/keys';
import PolicySections from './ModelPolicy/PolicySections';

const AdminModelPolicyPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('model-policy'), () =>
    adminCommercialService.getSettingsSection('model-policy'),
  );

  const defaultModelOptions = useMemo(
    () =>
      (data?.sharedHealth?.enabledNewapiModels ?? []).map((model) => ({
        label: model.displayName || model.modelId,
        value: model.modelId,
      })),
    [data?.sharedHealth?.enabledNewapiModels],
  );

  useEffect(() => {
    const config = data?.modelPolicyConfig;
    if (!config) return;

    form.setFieldsValue({
      allowlistText: config.allowlistText || '',
      applyToEmbeddings: config.applyToEmbeddings,
      applyToGenerateObject: config.applyToGenerateObject,
      blocklistText: config.blocklistText || '',
      defaultModelFallback: config.defaultModelFallback || '',
      deniedMessage: config.deniedMessage,
      enabled: config.enabled,
      mode: config.mode,
    });
  }, [data, form]);

  const handleSave = async () => {
    if (!data) return;

    setSubmitting(true);

    try {
      const values = await form.validateFields();
      await adminCommercialService.setAppSettingsBatch({
        updates: [
          { key: SETTING_KEYS.enabled, value: values.enabled },
          { key: SETTING_KEYS.mode, value: values.mode },
          {
            key: SETTING_KEYS.allowlist,
            value: normalizeListText(values.allowlistText),
          },
          {
            key: SETTING_KEYS.blocklist,
            value: normalizeListText(values.blocklistText),
          },
          {
            key: SETTING_KEYS.deniedMessage,
            value: values.deniedMessage,
          },
          {
            key: SETTING_KEYS.applyToEmbeddings,
            value: values.applyToEmbeddings,
          },
          {
            key: SETTING_KEYS.applyToGenerateObject,
            value: values.applyToGenerateObject,
          },
          {
            key: SETTING_KEYS.defaultModelFallback,
            value: values.defaultModelFallback,
          },
        ],
      });

      message.success(t('admin.modelPolicy.saveSuccess', '全局模型策略已保存'));
    } catch {
      message.error(t('admin.modelPolicy.saveFailed', '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageShell
      title={t('admin.modelPolicy.title', '全局模型策略')}
      width="medium"
      description={t(
        'admin.modelPolicy.subtitle',
        '集中设置全局模型访问策略、适用范围和默认兜底模型。',
      )}
    >
      {error ? (
        <AdminPageError
          description={t('admin.modelPolicy.loadFailed', '无法读取当前模型策略，请重试。')}
          onRetry={refresh}
        />
      ) : null}
      <Form
        disabled={isLoading || !data}
        form={form}
        layout="vertical"
        initialValues={{
          allowlistText: '',
          applyToEmbeddings: true,
          applyToGenerateObject: true,
          blocklistText: '',
          defaultModelFallback: '',
          deniedMessage: GLOBAL_MODEL_POLICY_DENIED_MESSAGE,
          enabled: false,
          mode: 'blocklist',
        }}
      >
        <Flexbox gap={24}>
          <PolicySections
            defaultModelOptions={defaultModelOptions}
            form={form}
            isLoading={isLoading}
          />

          <AdminFormActions label={t('admin.modelPolicy.actions', '模型策略操作')}>
            <Button
              disabled={isLoading || !data}
              loading={submitting}
              type="primary"
              onClick={handleSave}
            >
              {t('admin.settings.save', '保存')}
            </Button>
          </AdminFormActions>
        </Flexbox>
      </Form>
    </AdminPageShell>
  );
});

AdminModelPolicyPage.displayName = 'AdminModelPolicyPage';

export default AdminModelPolicyPage;
