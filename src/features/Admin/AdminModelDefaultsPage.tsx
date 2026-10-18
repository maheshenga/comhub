'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert } from '@lobehub/ui/base-ui';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageShell } from './layout';
import EditModelDefaultsModal from './ModelDefaults/EditModelDefaultsModal';
import ModelDefaultsTable from './ModelDefaults/ModelDefaultsTable';
import {
  buildModelDefaultsRows,
  EMPTY_MODEL_DEFAULTS_CONFIG,
  type ModelDefaultsConfig,
  type ModelDefaultsEnabledModel,
  type ModelDefaultsRow,
} from './ModelDefaults/shared';
import { buildModelDefaultsUpdates } from './ModelDefaults/updates';

const AdminModelDefaultsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.systemWrite);
  const [editingRow, setEditingRow] = useState<ModelDefaultsRow | null>(null);
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('model-defaults'), () =>
    adminCommercialService.getSettingsSection('model-defaults'),
  );

  const config = data?.modelDefaults ?? EMPTY_MODEL_DEFAULTS_CONFIG;
  const models = useMemo(
    () => (data?.sharedHealth?.enabledNewapiModels ?? []) as ModelDefaultsEnabledModel[],
    [data?.sharedHealth?.enabledNewapiModels],
  );
  const rows = useMemo(() => buildModelDefaultsRows(models, config), [config, models]);

  const handleSave = async (nextConfig: ModelDefaultsConfig) => {
    await adminCommercialService.setAppSettingsBatch(buildModelDefaultsUpdates(nextConfig));
    // The write is already committed at this point; a failed revalidation must
    // not surface as a save failure. The next revalidation retries the read.
    try {
      await refresh();
    } catch {
      // ignore revalidation errors
    }
  };

  return (
    <AdminPageShell
      title={t('admin.modelDefaults.title', '模型默认参数')}
      width="large"
      description={t(
        'admin.modelDefaults.subtitle',
        '为每个模型设置平台默认的上下文窗口与思考强度；用户显式保存后以用户值为准。',
      )}
    >
      <Flexbox gap={16}>
        {!canWrite ? (
          <Alert
            showIcon
            type="info"
            message={t(
              'admin.modelDefaults.readOnly',
              '当前角色仅有只读权限，无法修改模型默认参数。',
            )}
          />
        ) : null}
        <ModelDefaultsTable
          canWrite={canWrite}
          error={error}
          loading={isLoading}
          rows={rows}
          onEdit={setEditingRow}
          onRetry={refresh}
        />
      </Flexbox>

      <EditModelDefaultsModal
        config={config}
        model={editingRow}
        open={Boolean(editingRow)}
        onClose={() => setEditingRow(null)}
        onReload={refresh}
        onSave={handleSave}
      />
    </AdminPageShell>
  );
});

AdminModelDefaultsPage.displayName = 'AdminModelDefaultsPage';

export default AdminModelDefaultsPage;
