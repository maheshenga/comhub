'use client';

import { Icon } from '@lobehub/ui';
import { toast } from '@lobehub/ui/base-ui';
import { Button, Empty, Table } from 'antd';
import { RefreshCw } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { serverConfigKeys } from '@/libs/swr/keys';
import { adminCommercialService } from '@/services/adminCommercial';
import { useAiInfraStore } from '@/store/aiInfra';

import type { AdminDangerousActionEnvelope } from './adminDangerousActions';
import { AdminPageError, AdminPageShell, AdminResponsiveTable, AdminSection } from './layout';
import InstanceFormModal from './Providers/InstanceFormModal';
import ModelsDrawer from './Providers/ModelsDrawer';
import {
  type InstanceRow,
  INSTANCES_KEY,
  MODEL_TYPES,
  modelsKey,
} from './Providers/shared';
import { buildInstanceColumns } from './Providers/useInstanceColumns';

const AdminProvidersPage = memo(() => {
  const { t } = useTranslation('subscription');
  const refreshAiProviderRuntimeState = useAiInfraStore((s) => s.refreshAiProviderRuntimeState);
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(INSTANCES_KEY, () => adminCommercialService.listAiProviderInstances());

  const [editing, setEditing] = useState<InstanceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [modelsTarget, setModelsTarget] = useState<InstanceRow | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refreshingRuntimeCache, setRefreshingRuntimeCache] = useState(false);

  const items = (data?.items ?? []) as InstanceRow[];

  const handleToggle = async (row: InstanceRow) => {
    await adminCommercialService.toggleAiProviderInstance({ enabled: !row.enabled, id: row.id });
    await mutate(INSTANCES_KEY);
  };

  const handleDelete = async (
    row: InstanceRow,
    command: AdminDangerousActionEnvelope<'newapiProvider.deleteInstance'>,
  ) => {
    await adminCommercialService.deleteAiProviderInstance(
      { id: row.id, reason: command.reason?.trim() },
      command,
    );
    toast.success(t('admin.providers.deleteSuccess', '实例已删除'));
    await mutate(INSTANCES_KEY);
  };

  const handleTestConnection = async (row: InstanceRow) => {
    setTestingId(row.id);
    try {
      const result = await adminCommercialService.testAiProviderInstanceConnection(row.id);
      if (result.ok) {
        toast.success(
          t(
            'admin.providers.test.success',
            '连接成功：模型 {{modelsCount}} 个，价格 {{pricingCount}} 条',
            {
              modelsCount: result.modelsCount,
              pricingCount: result.pricingCount,
            },
          ),
        );
      } else {
        toast.error(
          t('admin.providers.test.failed', '连接失败：{{error}}', {
            error: result.error || t('admin.providers.test.unknownError', '未知错误'),
          }),
        );
      }
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncModels = async (row: InstanceRow) => {
    setSyncingId(row.id);
    try {
      const result = await adminCommercialService.syncAiProviderInstanceModels(row.id);
      toast.success(
        t(
          'admin.providers.sync.success',
          '同步完成：删除 {{deletedCount}} 个旧模型，导入 {{count}} 个新模型；同步价格 {{pricingCount}} 条，能力信息覆盖 {{abilitiesCount}} 个模型。新模型默认未启用。',
          {
            abilitiesCount: result.abilitiesCount,
            count: result.importedCount,
            deletedCount: result.deletedCount,
            pricingCount: result.pricingCount,
          },
        ),
      );
      await Promise.all(MODEL_TYPES.map((type) => mutate(modelsKey(row.id, type))));
      await refreshAiProviderRuntimeState();
    } catch (error) {
      toast.error(
        t('admin.providers.sync.failed', '同步失败：{{error}}', {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setSyncingId(null);
    }
  };

  const handleRefreshRuntimeCache = async () => {
    if (!data) return;

    setRefreshingRuntimeCache(true);
    try {
      const result = await adminCommercialService.refreshAiProviderRuntimeCache();
      await mutate(serverConfigKeys.get);
      await Promise.all([refreshAiProviderRuntimeState(), mutate(INSTANCES_KEY)]);
      toast.success(
        t('admin.providers.refreshRuntimeCache.success', '用户模型缓存已更新：{{time}}', {
          time: new Date(result.refreshedAt).toLocaleString(),
        }),
      );
    } catch (error) {
      toast.error(
        t('admin.providers.refreshRuntimeCache.failed', '更新用户缓存失败：{{error}}', {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setRefreshingRuntimeCache(false);
    }
  };

  const columns = buildInstanceColumns({
    handleDelete,
    handleSyncModels,
    handleTestConnection,
    handleToggle,
    setEditing,
    setModelsTarget,
    syncingId,
    t: t as any,
    testingId,
  });

  return (
    <AdminPageShell
      title={t('admin.providers.title', '服务商管理')}
      width="full"
      actions={
        <>
          <Button
            disabled={isLoading || !data || refreshingRuntimeCache}
            icon={<Icon icon={RefreshCw} size={14} />}
            loading={refreshingRuntimeCache}
            onClick={handleRefreshRuntimeCache}
          >
            {t('admin.providers.refreshRuntimeCache.action', '更新用户缓存')}
          </Button>
          <Button disabled={isLoading || !data} type="primary" onClick={() => setCreating(true)}>
            {t('admin.providers.createInstance', '新建实例')}
          </Button>
        </>
      }
      description={t(
        'admin.providers.intro',
        '配置多个服务商上游实例，并按模型类型登记可用模型。运行时会优先使用匹配模型且优先级最高的实例，失败时按优先级切换到下一个实例。',
      )}
    >
      {error ? (
        <AdminPageError
          description={t('admin.providers.loadFailed', '无法读取服务商实例，请重试。')}
          onRetry={refresh}
        />
      ) : null}

      <AdminSection
        title={t('admin.providers.instanceSection', '服务商实例')}
        description={t('admin.providers.instanceSummary', '共 {{count}} 个服务商实例', {
          count: items.length,
        })}
      >
        {!isLoading && items.length === 0 ? (
          <Empty description={t('admin.providers.empty', '暂未配置服务商实例')} />
        ) : (
          <AdminResponsiveTable label={t('admin.providers.tableLabel', '服务商实例表格')}>
            <Table
              columns={columns as any}
              dataSource={items}
              loading={isLoading}
              pagination={false}
              rowKey="id"
            />
          </AdminResponsiveTable>
        )}
      </AdminSection>

      <InstanceFormModal open={creating} onClose={() => setCreating(false)} />
      <InstanceFormModal initial={editing} open={!!editing} onClose={() => setEditing(null)} />
      <ModelsDrawer instance={modelsTarget} onClose={() => setModelsTarget(null)} />
    </AdminPageShell>
  );
});

AdminProvidersPage.displayName = 'AdminProvidersPage';

export default AdminProvidersPage;
