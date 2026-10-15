'use client';

import { AdminDataTable } from '../shared';
import { AdminPageError } from '../shared/AdminPageState';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

interface OrderTableAreaProps {
  columns: any[];
  data?: { items: any[] } | null;
  error: unknown;
  /** 存在生效筛选（状态/用户）时为 true；空结果走 SearchX + 清除筛选空态。 */
  hasActiveFilters: boolean;
  isLoading: boolean;
  /** 清除全部筛选（状态 + 用户 ID），供 filtered 空态按钮调用。 */
  onClearFilters: () => void;
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
  hasActiveFilters,
  isLoading,
  rowSelection,
  t,
  onClearFilters,
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
    <AdminDataTable
      columns={columns}
      dataSource={data?.items ?? []}
      emptyKind={hasActiveFilters ? 'filtered' : 'initial'}
      isEmpty={!isLoading && (data?.items ?? []).length === 0}
      loading={isLoading}
      regionLabel={t('admin.orders.tableLabel', '订单数据表')}
      rowKey="id"
      rowSelection={rowSelection}
      onClearFilters={onClearFilters}
    />
  );
};
