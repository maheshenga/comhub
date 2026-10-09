'use client';

import { Button, confirmModal } from '@lobehub/ui/base-ui';

import { AdminFormActions } from '../layout';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

export const SyncActionButtons = ({
  disabled,
  handleSave,
  scope,
  submitting,
  syncing,
  t,
}: {
  disabled: boolean;
  handleSave: (syncMode?: 'runtime-memory' | 'user-defaults') => Promise<void>;
  scope: 'ai-runtime-defaults' | 'integrations' | 'user-defaults';
  submitting: boolean;
  syncing: boolean;
  t: TFn;
}) => {
  const saveLabel = scope === 'user-defaults' ? '保存用户默认值' : '保存设置';

  return (
    <AdminFormActions label={t('admin.defaultSettings.actions', '默认设置操作')}>
      {scope === 'user-defaults' ? (
        <Button
          danger
          disabled={disabled}
          loading={syncing}
          onClick={() => {
            confirmModal({
              cancelText: t('admin.defaultSettings.userDefaults.syncCancel'),
              content: t('admin.defaultSettings.userDefaults.syncDescription'),
              okText: t('admin.defaultSettings.userDefaults.syncConfirm'),
              onOk: () => handleSave('user-defaults'),
              title: t('admin.defaultSettings.userDefaults.syncTitle'),
            });
          }}
        >
          {t('admin.defaultSettings.userDefaults.saveAndSync')}
        </Button>
      ) : null}
      {scope === 'ai-runtime-defaults' ? (
        <Button
          danger
          disabled={disabled}
          loading={syncing}
          onClick={() => {
            confirmModal({
              cancelText: t('admin.defaultSettings.aiRuntime.syncCancel'),
              content: t('admin.defaultSettings.aiRuntime.syncDescription'),
              okText: t('admin.defaultSettings.aiRuntime.syncConfirm'),
              onOk: () => handleSave('runtime-memory'),
              title: t('admin.defaultSettings.aiRuntime.syncTitle'),
            });
          }}
        >
          {t('admin.defaultSettings.aiRuntime.saveAndSync')}
        </Button>
      ) : null}
      <Button
        disabled={disabled}
        loading={submitting && !syncing}
        type="primary"
        onClick={() => handleSave()}
      >
        {saveLabel}
      </Button>
    </AdminFormActions>
  );
};

export default SyncActionButtons;
