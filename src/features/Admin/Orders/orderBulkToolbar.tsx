'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Alert } from 'antd';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';

import AdminBulkActionFlow from '@/features/Admin/AdminBulkActionFlow';
import { adminCommercialService } from '@/services/adminCommercial';

import { downloadOrdersCsv } from './ordersCsv';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export type BulkOrderDryRun = {
  results: Array<{ error?: null | string; ok: boolean; orderId: string }>;
};

/** 订单批量动作工具条（M5 §5.2：批量过期/取消 + 预检 + CSV 导出，从 AdminOrdersPage 抽出）。 */
export const OrderBulkToolbar = ({
  effectiveSelectedIds,
  onClearSelection,
  onDryRun,
  orderRows,
  refresh,
  setBulkDryRun,
  t,
}: {
  effectiveSelectedIds: string[];
  onClearSelection: () => void;
  onDryRun: (orderIds: string[], action: 'bulkCancel' | 'bulkExpire') => Promise<unknown>;
  orderRows: Array<Record<string, any>>;
  refresh: () => Promise<unknown>;
  setBulkDryRun: (value: BulkOrderDryRun | null) => void;
  t: TFn;
}) => {
  const exportCsv = () => downloadOrdersCsv(orderRows);

  return (
    <Flexbox horizontal gap={8}>
      <AdminBulkActionFlow
        actionId="order.bulkExpire"
        count={effectiveSelectedIds.length}
        size="small"
        confirmTitle={t('admin.orders.bulkExpireTitle', '批量过期 {{count}} 个待支付订单？', {
          count: effectiveSelectedIds.length,
        })}
        confirmDescription={t(
          'admin.orders.bulkExpireDescription',
          '将选中的待支付兑换订单标记为已过期。执行前会先做只读预检。',
        )}
        onRun={async (command) =>
          adminCommercialService.bulkExpireOrders(effectiveSelectedIds, command)
        }
        onSuccess={async () => {
          onClearSelection();
          setBulkDryRun(null);
          await refresh();
        }}
        summary={(result: any) => ({
          failed: result?.results?.filter((r: any) => !r.ok).length ?? 0,
          requested: result?.total,
          succeeded: result?.results?.filter((r: any) => r.ok).length ?? 0,
        })}
      >
        {t('admin.orders.bulkExpire', '批量过期')}
      </AdminBulkActionFlow>
      <AdminBulkActionFlow
        danger
        actionId="order.bulkCancel"
        count={effectiveSelectedIds.length}
        size="small"
        confirmTitle={t('admin.orders.bulkCancelTitle', '批量取消 {{count}} 个待支付订单？', {
          count: effectiveSelectedIds.length,
        })}
        confirmDescription={t(
          'admin.orders.bulkCancelDescription',
          '将选中的待支付兑换订单标记为已取消。执行前会先做只读预检。',
        )}
        onRun={async (command) =>
          adminCommercialService.bulkCancelOrders(effectiveSelectedIds, command)
        }
        onSuccess={async () => {
          onClearSelection();
          setBulkDryRun(null);
          await refresh();
        }}
        summary={(result: any) => ({
          failed: result?.results?.filter((r: any) => !r.ok).length ?? 0,
          requested: result?.total,
          succeeded: result?.results?.filter((r: any) => r.ok).length ?? 0,
        })}
      >
        {t('admin.orders.bulkCancel', '批量取消')}
      </AdminBulkActionFlow>
      <Button
        size="small"
        onClick={async () => {
          await onDryRun(effectiveSelectedIds, 'bulkExpire');
        }}
      >
        {t('admin.orders.bulkDryRun', '预检')}
      </Button>
      <Button size="small" onClick={exportCsv}>
        {t('admin.shared.dataTable.exportCsv', '导出 CSV')}
      </Button>
    </Flexbox>
  );
};

/** 批量预检结果提示条（M5 §5.2：dry-run 命中/失败摘要，从 AdminOrdersPage 抽出）。 */
export const BulkDryRunAlert = ({
  dryRun,
  onDismiss,
  t,
}: {
  dryRun: BulkOrderDryRun | null;
  onDismiss: () => void;
  t: TFn;
}) => {
  const { t: translate } = useTranslation('subscription');

  if (!dryRun) return null;

  return (
    <Alert
      closable
      description={dryRun.results
        .filter((item) => !item.ok)
        .slice(0, 5)
        .map((item) => `${item.orderId}: ${item.error}`)
        .join('；')}
      message={t('admin.orders.bulkDryRunSummary', '预检完成：{{ok}} 个可处理 / {{total}} 个', {
        ok: dryRun.results.filter((item) => item.ok).length,
        total: dryRun.results.length,
      })}
      showIcon
      type="info"
      onClose={() => {
        onDismiss();
        void translate;
      }}
    />
  );
};

export const isBulkEligibleOrder = (row: Record<string, any>) =>
  row.status === 'pending' &&
  (row.source === 'redemption' || row.provider === 'redemption' || row.redemptionCodeId);

export const orderRowSelection = (
  effectiveSelectedIds: string[],
  setSelectedOrderIds: (ids: string[]) => void,
): React.Key[] | any => ({
  getCheckboxProps: (row: any) => ({ disabled: !isBulkEligibleOrder(row) }),
  onChange: (keys: React.Key[]) => setSelectedOrderIds(keys.map(String)),
  selectedRowKeys: effectiveSelectedIds,
});
