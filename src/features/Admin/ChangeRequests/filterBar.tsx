'use client';

import { Button, Flexbox, Input, Select } from '@lobehub/ui';

import type { ChangeRequestStatusFilter } from './shared';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

export const ChangeRequestFilters = ({
  onStatusChange,
  onUserIdFilterChange,
  status,
  t,
  userIdFilter,
}: {
  onStatusChange: (status: ChangeRequestStatusFilter) => void;
  onUserIdFilterChange: (value: string) => void;
  status: ChangeRequestStatusFilter;
  t: TFn;
  userIdFilter: string;
}) => (
  <Flexbox horizontal gap={12} style={{ flex: '1 1 420px', flexWrap: 'wrap' }}>
    <Select
      style={{ width: 160 }}
      value={status}
      options={[
        { label: t('admin.changeRequests.status.all', '全部'), value: 'all' },
        { label: t('admin.changeRequests.status.pending', '待处理'), value: 'pending' },
        { label: t('admin.changeRequests.status.completed', '已完成'), value: 'completed' },
        { label: t('admin.changeRequests.status.canceled', '已取消'), value: 'canceled' },
        { label: t('admin.changeRequests.status.rejected', '已拒绝'), value: 'rejected' },
      ]}
      onChange={onStatusChange}
    />
    <Input
      allowClear
      placeholder={t('admin.changeRequests.filter.user', '用户 ID')}
      style={{ width: 240 }}
      value={userIdFilter}
      onChange={(event: { target: { value: string } }) => onUserIdFilterChange(event.target.value)}
    />
  </Flexbox>
);

export const CursorPagination = ({
  hasNext: _hasNext,
  hasPrevious,
  isLoading,
  onNext,
  onPrevious,
  t,
}: {
  hasNext: boolean;
  hasPrevious: boolean;
  isLoading: boolean;
  onNext: () => void;
  onPrevious: () => void;
  t: TFn;
}) => (
  <Flexbox horizontal align="center" gap={8}>
    <Button disabled={!hasPrevious} onClick={onPrevious}>
      {t('admin.pagination.previous', '上一页')}
    </Button>
    <Button loading={isLoading} onClick={onNext}>
      {t('admin.pagination.next', '下一页')}
    </Button>
  </Flexbox>
);
