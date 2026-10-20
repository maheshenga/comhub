'use client';

import { Button, Flexbox, Text } from '@lobehub/ui';
import type { TableColumnsType } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getAdminModelTypeLabel } from '../adminModelTypeLabels';
import { AdminDataTable } from '../shared';
import { getModelReasoningParams } from './reasoningOptions';
import { formatContextTokens, formatReasoningSummary, type ModelDefaultsRow } from './shared';

interface ModelDefaultsTableProps {
  canWrite: boolean;
  error?: unknown;
  loading: boolean;
  onEdit: (row: ModelDefaultsRow) => void;
  onRetry: () => Promise<unknown> | unknown;
  rows: ModelDefaultsRow[];
}

export const ModelDefaultsTable = memo<ModelDefaultsTableProps>(
  ({ canWrite, error, loading, onEdit, onRetry, rows }) => {
    const { t } = useTranslation('subscription');

    const columns = useMemo<TableColumnsType<ModelDefaultsRow>>(
      () => [
        {
          dataIndex: 'displayName',
          key: 'model',
          render: (_, row) => (
            <Flexbox gap={0}>
              <span>{row.displayName}</span>
              <Text type="secondary">{row.modelId}</Text>
            </Flexbox>
          ),
          title: t('admin.modelDefaults.columns.model', '模型'),
          width: 220,
        },
        {
          dataIndex: 'instanceLabel',
          key: 'provider',
          render: (_, row) => (
            <Flexbox gap={0}>
              <span>{row.instanceLabel}</span>
              <Text type="secondary">
                {[row.providerId, row.providerType, getAdminModelTypeLabel(row.modelType)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Flexbox>
          ),
          title: t('admin.modelDefaults.columns.provider', '服务商 / 实例'),
          width: 220,
        },
        {
          dataIndex: 'contextTokens',
          key: 'contextWindow',
          render: (_, row) => (
            <Text type={row.contextTokens === undefined ? 'secondary' : undefined}>
              {formatContextTokens(row.contextTokens)}
            </Text>
          ),
          title: t('admin.modelDefaults.columns.contextWindow', '上下文默认'),
          width: 140,
        },
        {
          dataIndex: 'reasoningConfig',
          key: 'reasoning',
          render: (_, row) => {
            const paramKeys = getModelReasoningParams(row.extendParams);

            return (
              <Text type={row.reasoningConfig ? undefined : 'secondary'}>
                {formatReasoningSummary(row.reasoningConfig, paramKeys)}
              </Text>
            );
          },
          title: t('admin.modelDefaults.columns.reasoning', '思考强度摘要'),
        },
        {
          key: 'actions',
          render: (_, row) => (
            <Button disabled={!canWrite} size="small" onClick={() => onEdit(row)}>
              {t('admin.modelDefaults.edit', '编辑')}
            </Button>
          ),
          title: t('admin.modelDefaults.columns.actions', '操作'),
          width: 100,
        },
      ],
      [canWrite, onEdit, t],
    );

    return (
      <AdminDataTable
        columns={columns}
        dataSource={rows}
        emptyTitle={t('admin.modelDefaults.empty', '暂无可配置的对话或向量模型')}
        error={error}
        isEmpty={rows.length === 0}
        loading={loading}
        pagination={{ defaultPageSize: 50, hideOnSinglePage: true, showSizeChanger: true }}
        regionLabel={t('admin.modelDefaults.tableRegion', '模型默认参数列表')}
        rowKey="key"
        scrollX={900}
        onRetry={() => void onRetry()}
      />
    );
  },
);

ModelDefaultsTable.displayName = 'ModelDefaultsTable';

export default ModelDefaultsTable;
