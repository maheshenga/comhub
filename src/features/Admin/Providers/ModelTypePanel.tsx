'use client';

import { Flexbox } from '@lobehub/ui';
import { confirmModal, toast } from '@lobehub/ui/base-ui';
import { Button, Empty, Input, Table } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useAiInfraStore } from '@/store/aiInfra';

import AdminDependencyImpactPreview from '../AdminDependencyImpactPreview';
import type { AdminModelAbilities } from '../adminProviderModelAbilities';
import { buildManualAbilitiesMetadata } from '../adminProviderModelAbilities';
import {
  buildManualMediaPricingMetadata,
  buildManualTokenPricingMetadata,
} from '../adminProviderModelPricing';
import { buildModelTypeColumns } from './ModelTypeColumns';
import type { MODEL_TYPES,ModelRow } from './shared';
import { modelsKey, splitToList } from './shared';


const ModelTypePanel = memo<{ instanceId: string; modelType: (typeof MODEL_TYPES)[number] }>(
  ({ instanceId, modelType }) => {
    const { t } = useTranslation('subscription');
    const refreshAiProviderRuntimeState = useAiInfraStore((s) => s.refreshAiProviderRuntimeState);
    const swrKey = modelsKey(instanceId, modelType);
    const { data, isLoading } = useClientDataSWR(swrKey, () =>
      adminCommercialService.listAiProviderInstanceModels({ instanceId, modelType }),
    );
    const items = (data?.items ?? []) as ModelRow[];

    const [bulkText, setBulkText] = useState('');
    const [adding, setAdding] = useState(false);
    const [batchUpdating, setBatchUpdating] = useState<'disable' | 'enable' | null>(null);

    const refreshModels = async () => {
      await mutate(swrKey);
      await refreshAiProviderRuntimeState();
    };

    const handleBulkAdd = async () => {
      const ids = splitToList(bulkText);
      if (ids.length === 0) return;
      setAdding(true);
      try {
        await adminCommercialService.addAiProviderInstanceModels({
          instanceId,
          models: ids.map((id, i) => ({
            enabled: true,
            modelId: id,
            modelType,
            sortOrder: i,
          })),
        });
        toast.success(t('admin.providers.models.addSuccess', '模型已添加'));
        setBulkText('');
        await refreshModels();
      } catch {
        toast.error(t('admin.providers.models.addFailed', '添加模型失败'));
      } finally {
        setAdding(false);
      }
    };

    const handleBatchToggle = async (enabled: boolean) => {
      const targetRows = items.filter((item) => item.enabled !== enabled);
      if (targetRows.length === 0) return;

      setBatchUpdating(enabled ? 'enable' : 'disable');
      try {
        await adminCommercialService.setAiProviderInstanceModelsEnabled({
          enabled,
          instanceId,
          models: targetRows.map(({ modelId, modelType }) => ({ modelId, modelType })),
        });
        toast.success(
          enabled
            ? t('admin.providers.models.enableAllSuccess', '已启用当前类型模型')
            : t('admin.providers.models.disableAllSuccess', '已禁用当前类型模型'),
        );
        await refreshModels();
      } catch {
        toast.error(t('admin.providers.models.batchToggleFailed', '批量更新模型失败'));
      } finally {
        setBatchUpdating(null);
      }
    };

    const handleToggle = async (row: ModelRow) => {
      await adminCommercialService.updateAiProviderInstanceModel({
        data: { enabled: !row.enabled },
        instanceId,
        modelId: row.modelId,
        modelType: row.modelType,
      });
      await refreshModels();
    };

    const handleRename = async (row: ModelRow, displayName: string) => {
      await adminCommercialService.updateAiProviderInstanceModel({
        data: { displayName: displayName || undefined },
        instanceId,
        modelId: row.modelId,
        modelType: row.modelType,
      });
      await refreshModels();
    };

    const handleUpdateTokenPricing = async (
      row: ModelRow,
      inputCostRate?: number,
      outputCostRate?: number,
    ) => {
      const metadata =
        row.modelType === 'image' || row.modelType === 'video'
          ? buildManualMediaPricingMetadata({
              imageRate: row.modelType === 'image' ? inputCostRate : undefined,
              metadata: row.metadata,
              videoRate: row.modelType === 'video' ? outputCostRate : undefined,
            })
          : buildManualTokenPricingMetadata({
              inputCostRate,
              metadata: row.metadata,
              outputCostRate,
            });

      await adminCommercialService.updateAiProviderInstanceModel({
        data: { metadata },
        instanceId,
        modelId: row.modelId,
        modelType: row.modelType,
      });
      await refreshModels();
    };

    const handleUpdateAbilities = async (row: ModelRow, abilities: AdminModelAbilities) => {
      await adminCommercialService.updateAiProviderInstanceModel({
        data: {
          metadata: buildManualAbilitiesMetadata({
            abilities,
            metadata: row.metadata,
          }),
        },
        instanceId,
        modelId: row.modelId,
        modelType: row.modelType,
      });
      await refreshModels();
    };

    const handleDelete = async (row: ModelRow) => {
      const target = {
        instanceId,
        modelId: row.modelId,
        modelType: row.modelType,
      };
      const impact = await adminCommercialService.getAiProviderModelDeleteImpact(target);

      confirmModal({
        content: <AdminDependencyImpactPreview impact={impact} />,
        okButtonProps: { danger: true, disabled: !impact.canProceed },
        okText: t('admin.providers.models.confirmRemove', '移除'),
        title: t('admin.providers.models.confirmRemoveTitle', '移除这个模型？'),
        onOk: async () => {
          await adminCommercialService.removeAiProviderInstanceModel(target);
          await refreshModels();
        },
      });
    };

    const columns = buildModelTypeColumns({
      handleDelete,
      handleRename,
      handleToggle,
      handleUpdateAbilities,
      handleUpdateTokenPricing,
      t,
    });

    return (
      <Flexbox gap={12}>
        <Flexbox gap={8}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {t('admin.providers.models.bulkAddHint', '可批量添加模型 ID，使用换行或逗号分隔。')}
          </div>
          <Input.TextArea
            placeholder={'gpt-4o-mini\ngpt-4o'}
            rows={3}
            value={bulkText}
            onChange={(e: { target: { value: string } }) => setBulkText(e.target.value)}
          />
          <Flexbox horizontal>
            <Button
              disabled={!bulkText.trim()}
              loading={adding}
              type="primary"
              onClick={handleBulkAdd}
            >
              {t('admin.providers.models.add', '添加模型')}
            </Button>
          </Flexbox>
        </Flexbox>
        {!isLoading && items.length === 0 ? (
          <Empty description={t('admin.providers.models.empty', '该类型暂无模型')} />
        ) : (
          <Flexbox gap={8}>
            <Flexbox horizontal gap={8} justify="flex-end">
              <Button
                disabled={!items.some((item) => !item.enabled)}
                loading={batchUpdating === 'enable'}
                size="small"
                onClick={() => handleBatchToggle(true)}
              >
                {t('admin.providers.models.enableAll', '启用当前类型')}
              </Button>
              <Button
                disabled={!items.some((item) => item.enabled)}
                loading={batchUpdating === 'disable'}
                size="small"
                onClick={() => handleBatchToggle(false)}
              >
                {t('admin.providers.models.disableAll', '禁用当前类型')}
              </Button>
            </Flexbox>
            <Table
              columns={columns as any}
              dataSource={items}
              loading={isLoading}
              pagination={false}
              rowKey={(r: ModelRow) => `${r.modelId}__${r.modelType}`}
              size="small"
            />
          </Flexbox>
        )}
      </Flexbox>
    );
  },
);

ModelTypePanel.displayName = 'ModelTypePanel';

export default ModelTypePanel;
