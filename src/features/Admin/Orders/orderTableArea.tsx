'use client';

import InlineTable from '@/components/InlineTable';

import { AdminResponsiveTable } from '../layout';
import { AdminPageError } from '../shared/AdminPageState';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

interface OrderTableAreaProps {
  columns: any[];
  data?: { items: any[] } | null;
  error: unknown;
  isLoading: boolean;
  onRetry: () => void;
  /** 由页面用 orderRowSelection(...) 派生（含不合格行禁选逻辑），原样透传。 */
  rowSelection: any;
  t: TFn;
}

/** 订单列表的表格区：加载失败出重试错误态，否则渲染数据表（含行选择）。 */
export const OrderTableArea = ({
  columns,
  data,
  error,
  isLoading,
  rowSelection,
  t,
  onRetry,
}: OrderTableAreaProps) => {
  if (error) {
    return (
      <AdminPageError
        description={t('admin.orders.loadFailed', '订单列表加载失败，请重试。')}
        onRetry={onRetry}
      />
    );
  }

  return (
    <AdminResponsiveTable label={t('admin.orders.tableLabel', '订单数据表')}>
      <InlineTable
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        locale={{ emptyText: t('admin.orders.empty', '暂无订单') }}
        rowKey="id"
        rowSelection={rowSelection}
      />
    </AdminResponsiveTable>
  );
};
