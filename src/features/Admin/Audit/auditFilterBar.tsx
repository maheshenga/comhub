'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { DatePicker, Input } from 'antd';
import { type Dayjs } from 'dayjs';

import type { AuditFilterKey } from '@/features/Admin/Audit/auditParts';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

/** 审计页筛选栏（§5.3 四维筛选 + 批量任务 ID + 时间范围 + 导出）。 */
export const AuditFilterBar = ({
  actionFilter,
  actorFilter,
  batchFilter,
  dateRangeFilter,
  exporting,
  resourceIdFilter,
  resourceTypeFilter,
  targetFilter,
  onDateRangeChange,
  onExport,
  onFilterChange,
  t,
}: {
  actionFilter: string;
  actorFilter: string;
  batchFilter: string;
  dateRangeFilter: [Dayjs | null, Dayjs | null] | null;
  exporting: boolean;
  resourceIdFilter: string;
  resourceTypeFilter: string;
  targetFilter: string;
  onDateRangeChange: (value: [Dayjs | null, Dayjs | null] | null) => void;
  onExport: () => void;
  onFilterChange: (key: AuditFilterKey, value: string) => void;
  t: TFn;
}) => (
  <Flexbox horizontal align="center" gap={12} style={{ flex: '1 1 520px', flexWrap: 'wrap' }}>
    <Input
      allowClear
      placeholder={t('admin.audit.filter.actor', '操作者用户 ID')}
      style={{ width: 'min(240px, 100%)' }}
      value={actorFilter}
      onChange={(e: { target: { value: string } }) => onFilterChange('actorUserId', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.target', '目标用户 ID')}
      style={{ width: 'min(240px, 100%)' }}
      value={targetFilter}
      onChange={(e: { target: { value: string } }) => onFilterChange('targetUserId', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.action', '操作（如 user.ban）')}
      style={{ width: 'min(240px, 100%)' }}
      value={actionFilter}
      onChange={(e: { target: { value: string } }) => onFilterChange('action', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.resourceType', '资源类型')}
      style={{ width: 'min(180px, 100%)' }}
      value={resourceTypeFilter}
      onChange={(e: { target: { value: string } }) => onFilterChange('resourceType', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.resourceId', '资源 ID')}
      style={{ width: 'min(240px, 100%)' }}
      value={resourceIdFilter}
      onChange={(e: { target: { value: string } }) => onFilterChange('resourceId', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.batch', '批量任务 ID（batchCorrelationId）')}
      style={{ width: 'min(280px, 100%)' }}
      value={batchFilter}
      onChange={(e: { target: { value: string } }) =>
        onFilterChange('batchCorrelationId', e.target.value)
      }
    />
    <DatePicker.RangePicker
      allowClear
      format="YYYY/MM/DD"
      style={{ width: 'min(260px, 100%)' }}
      value={dateRangeFilter}
      onChange={(values) => onDateRangeChange(values ? [values[0], values[1]] : null)}
    />
    <Button loading={exporting} onClick={onExport}>
      {t('admin.audit.exportCsv', '导出 CSV')}
    </Button>
  </Flexbox>
);

