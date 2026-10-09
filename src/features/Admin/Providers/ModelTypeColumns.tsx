'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Input, Switch, Tag } from 'antd';

import type { AdminModelAbilities } from '../adminProviderModelAbilities';
import { AiProviderModelAbilitiesCell } from '../adminProviderModelAbilities';
import { AiProviderModelPricingCell } from '../adminProviderModelPricing';
import { hasSyncedOrManualPricing } from './modelPricingStatus';
import type { ModelRow } from './shared';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

export interface ModelTypeColumnsParams {
  handleDelete: (row: ModelRow) => void;
  handleRename: (row: ModelRow, displayName: string) => Promise<void>;
  handleToggle: (row: ModelRow) => Promise<void>;
  handleUpdateAbilities: (row: ModelRow, abilities: AdminModelAbilities) => Promise<void>;
  handleUpdateTokenPricing: (
    row: ModelRow,
    inputCostRate?: number,
    outputCostRate?: number,
  ) => Promise<void>;
  t: TFn;
}

export const buildModelTypeColumns = ({
  handleDelete,
  handleRename,
  handleToggle,
  handleUpdateAbilities,
  handleUpdateTokenPricing,
  t,
}: ModelTypeColumnsParams) =>
  [
      {
        dataIndex: 'modelId',
        key: 'modelId',
        title: t('admin.providers.models.col.id', '模型 ID'),
      },
      {
        dataIndex: 'displayName',
        key: 'displayName',
        render: (v: string | null, r: ModelRow) => (
          <Input
            defaultValue={v ?? ''}
            placeholder={r.modelId}
            size="small"
            onBlur={(e: { target: { value: string } }) => {
              const next = e.target.value.trim();
              if ((v ?? '') !== next) handleRename(r, next);
            }}
          />
        ),
        title: t('admin.providers.models.col.displayName', '显示名称'),
        width: 220,
      },
      {
        key: 'pricing',
        render: (_: unknown, r: ModelRow) => (
          <Flexbox gap={6}>
            {!hasSyncedOrManualPricing(r.metadata) ? (
              <Tag color="orange">{t('admin.providers.models.pricing.missing', '未设置价格')}</Tag>
            ) : null}
            <AiProviderModelPricingCell
              metadata={r.metadata}
              modelType={r.modelType}
              t={t}
              onSave={(inputCostRate, outputCostRate) =>
                handleUpdateTokenPricing(r, inputCostRate, outputCostRate)
              }
            />
          </Flexbox>
        ),
        title: t('admin.providers.models.col.pricing', '成本价'),
        width: 280,
      },
      {
        key: 'abilities',
        render: (_: unknown, r: ModelRow) => (
          <AiProviderModelAbilitiesCell
            metadata={r.metadata}
            t={t}
            onSave={(abilities) => handleUpdateAbilities(r, abilities)}
          />
        ),
        title: t('admin.providers.models.col.abilities', '能力'),
        width: 360,
      },
      {
        dataIndex: 'enabled',
        key: 'enabled',
        render: (v: boolean, r: ModelRow) => (
          <Switch checked={v} size="small" onChange={() => handleToggle(r)} />
        ),
        title: t('admin.providers.models.col.enabled', '启用'),
        width: 100,
      },
      {
        key: 'actions',
        render: (_: unknown, r: ModelRow) => (
          <Button danger size="small" type="link" onClick={() => handleDelete(r)}>
            {t('admin.providers.models.remove', '移除')}
          </Button>
        ),
        title: t('admin.providers.models.col.actions', '操作'),
        width: 100,
      },
    ];
;
