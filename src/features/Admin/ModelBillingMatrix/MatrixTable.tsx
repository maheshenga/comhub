'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { Empty, InputNumber, Space, Switch, Table, Tag, Typography } from 'antd';

import { MATRIX_ACCESS_SAVE_LABEL, MATRIX_DISCARD_LABEL, MATRIX_PRICING_SAVE_LABEL } from '@/features/Admin/adminMatrixCopy';
import type { MatrixRow } from '@/features/Admin/adminModelBillingMatrix';
import { getAdminModelTypeLabel } from '@/features/Admin/adminModelTypeLabels';

import { AdminFormActions, AdminResponsiveTable, AdminSection } from '../layout';
import { PRICING_SOURCE_STATUS, toFiniteNumber  } from './shared';

const { Text } = Typography;

interface MatrixTableProps {
  canReadPlans: boolean;
  canReadSettings: boolean;
  canWriteFinance: boolean;
  canWriteSystem: boolean;
  displayRows: MatrixRow[];
  focusedPlanKeySet: Set<string>;
  loading: boolean;
  onDiscardRows: () => void;
  onSaveAccess: () => void;
  onSavePricing: () => void;
  onSetDefault: (row: MatrixRow) => void;
  onTogglePlanAccess: (current: MatrixRow[] | null, rowKey: string, plan: string, checked: boolean) => MatrixRow[];
  onUpdateRow: (rowKey: string, patch: Partial<MatrixRow>) => void;
  planData: Record<string, any> | undefined;
  plans: { displayName: string; plan: string }[];
  rows: MatrixRow[];
  rowsOverride: MatrixRow[] | null;
  saving: boolean;
  settings: Record<string, any> | undefined;
  t: (key: string, defaultValue?: string, values?: Record<string, unknown>) => string;
}

export const MatrixTable = ({
  canReadPlans,
  canReadSettings,
  canWriteFinance,
  canWriteSystem,
  focusedPlanKeySet,
  displayRows,
  loading,
  onDiscardRows,
  onSaveAccess,
  onSavePricing,
  onSetDefault,
  onTogglePlanAccess,
  onUpdateRow,
  planData,
  plans,
  rows,
  rowsOverride,
  saving,
  settings,
  t,
}: MatrixTableProps) => {
  const planColumns: TableColumnsType<MatrixRow> = plans.map((plan) => ({
    key: `plan-${plan.plan}`,
    render: (_, row) => (
      <Switch
        checked={row.planAccess[plan.plan] !== false}
        disabled={!canWriteFinance || !planData || saving}
        size="small"
        onChange={(checked: boolean) => onTogglePlanAccess(rowsOverride, row.key, plan.plan, checked)}
      />
    ),
    title: (
      <Space size={4}>
        <span>{plan.displayName}</span>
        {focusedPlanKeySet.has(plan.plan) ? <Tag color="orange">问题</Tag> : null}
      </Space>
    ),
    width: 104,
  }));

  const columns: TableColumnsType<MatrixRow> = [
    {
      key: 'model',
      render: (_, row) => (
        <Flexbox gap={4}>
          <Space wrap size={6}>
            <Text strong>{row.displayName}</Text>
            {row.isDefault && <Tag color="green">默认</Tag>}
          </Space>
          <Text copyable type="secondary">
            {row.modelId}
          </Text>
          <Space wrap size={4}>
            <Tag>{row.provider}</Tag>
            {row.providerType ? <Tag color="cyan">{row.providerType}</Tag> : null}
            {row.groupKey ? <Tag color="purple">{row.groupName || row.groupKey}</Tag> : null}
            <Tag>{getAdminModelTypeLabel(row.modelType)}</Tag>
            <Tag color={PRICING_SOURCE_STATUS[row.effectivePricingSource].color}>
              {PRICING_SOURCE_STATUS[row.effectivePricingSource].label}
            </Tag>
          </Space>
        </Flexbox>
      ),
      title: t('admin.modelBillingMatrix.col.model', '模型'),
      width: 280,
    },
    {
      dataIndex: 'instanceNames',
      key: 'instanceNames',
      render: (names: string[]) => (
        <Space wrap size={[4, 4]}>
          {names.map((name) => (
            <Tag key={name}>{name}</Tag>
          ))}
        </Space>
      ),
      title: t('admin.modelBillingMatrix.col.instances', '来源实例'),
      width: 220,
    },
    ...planColumns,
    {
      dataIndex: 'pricingMultiplier',
      key: 'pricingMultiplier',
      render: (value: number | undefined, row) => (
        <InputNumber
          disabled={!canWriteSystem || !settings || saving}
          min={0.0001}
          placeholder="默认"
          precision={4}
          size="small"
          step={0.1}
          style={{ width: 96 }}
          value={value}
          onChange={(next: number | null) =>
            onUpdateRow(row.key, { pricingMultiplier: toFiniteNumber(next) })
          }
        />
      ),
      title: t('admin.modelBillingMatrix.col.multiplier', '倍率'),
      width: 120,
    },
    {
      dataIndex: 'creditsPerDollar',
      key: 'creditsPerDollar',
      render: (value: number | undefined, row) => (
        <InputNumber
          disabled={!canWriteSystem || !settings || saving}
          min={1}
          placeholder="默认"
          size="small"
          style={{ width: 132 }}
          value={value}
          onChange={(next: number | null) =>
            onUpdateRow(row.key, { creditsPerDollar: toFiniteNumber(next) })
          }
        />
      ),
      title: t('admin.modelBillingMatrix.col.creditsPerDollar', '每美元积分'),
      width: 152,
    },
    {
      fixed: 'right',
      key: 'actions',
      render: (_, row) => (
        <Button
          disabled={!canWriteSystem || !planData || !settings || row.isDefault}
          loading={saving}
          size="small"
          onClick={() => onSetDefault(row)}
        >
          {row.isDefault ? '当前默认' : '设为默认'}
        </Button>
      ),
      title: t('admin.modelBillingMatrix.col.actions', '操作'),
      width: 124,
    },
  ];
  const visibleColumns: TableColumnsType<MatrixRow> = canReadSettings
    ? columns
    : columns.filter(
        (column) =>
          !['pricingMultiplier', 'creditsPerDollar', 'actions'].includes(String(column.key)),
      );

  return (
    <>
      <AdminSection
        description={`当前显示 ${displayRows.length}/${rows.length} 个模型`}
        title={t('admin.modelBillingMatrix.matrixSection', '模型权限与计费')}
      >
        <AdminResponsiveTable label="模型与计费矩阵">
          <Table
            columns={visibleColumns}
            dataSource={displayRows}
            loading={loading}
            locale={{ emptyText: <Empty description="暂无已启用的服务商模型" /> }}
            pagination={{ defaultPageSize: 50, hideOnSinglePage: true, showSizeChanger: true }}
            rowKey="key"
            scroll={{ x: 900 + plans.length * 104 }}
          />
        </AdminResponsiveTable>
      </AdminSection>

      <AdminFormActions label="模型与计费矩阵操作">
        {canReadPlans ? (
          <Button
            disabled={!canWriteFinance || !planData}
            loading={saving}
            type="primary"
            onClick={onSaveAccess}
          >
            {MATRIX_ACCESS_SAVE_LABEL}
          </Button>
        ) : null}
        {canReadSettings ? (
          <Button disabled={!canWriteSystem || !settings} loading={saving} onClick={onSavePricing}>
            {MATRIX_PRICING_SAVE_LABEL}
          </Button>
        ) : null}
        {rowsOverride && (
          <Button disabled={saving} onClick={onDiscardRows}>
            {MATRIX_DISCARD_LABEL}
          </Button>
        )}
      </AdminFormActions>
    </>
  );
};

MatrixTable.displayName = 'MatrixTable';
