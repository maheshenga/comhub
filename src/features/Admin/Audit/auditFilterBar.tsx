'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- base-ui 虽有 DatePicker，但值模型为 Date 而非 Dayjs，无 Dayjs drop-in 等价物；Input 与 RangePicker 同排构成筛选栏，迁 base-ui 属 B4 筛选器收敛批次统一处理。
import { DatePicker, Input } from 'antd';
import { type Dayjs } from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import type { AuditFilterKey } from '@/features/Admin/Audit/auditParts';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

const TEXT_FILTERS: Array<{
  filterKey: AuditFilterKey;
  placeholderKey: string;
  placeholder: string;
  width: number;
}> = [
  {
    filterKey: 'actorUserId',
    placeholderKey: 'admin.audit.filter.actor',
    placeholder: '操作者用户 ID',
    width: 240,
  },
  {
    filterKey: 'targetUserId',
    placeholderKey: 'admin.audit.filter.target',
    placeholder: '目标用户 ID',
    width: 240,
  },
  {
    filterKey: 'action',
    placeholderKey: 'admin.audit.filter.action',
    placeholder: '操作（如 user.ban）',
    width: 240,
  },
  {
    filterKey: 'resourceType',
    placeholderKey: 'admin.audit.filter.resourceType',
    placeholder: '资源类型',
    width: 180,
  },
  {
    filterKey: 'resourceId',
    placeholderKey: 'admin.audit.filter.resourceId',
    placeholder: '资源 ID',
    width: 240,
  },
  {
    filterKey: 'batchCorrelationId',
    placeholderKey: 'admin.audit.filter.batch',
    placeholder: '批量任务 ID（batchCorrelationId）',
    width: 280,
  },
];

/**
 * 审计页筛选栏（§5.3 四维筛选 + 批量任务 ID + 时间范围 + 导出）。
 *
 * 文本筛选走草稿态提交（与 AdminOrdersPage 的 userIdDraft 同一先例）：
 * 输入过程只更新草稿，回车或失焦才真正触发查询——此前每个字符都直连
 * onFilterChange 并 reset 游标，输入一个 24 位用户 ID 会打出 24 次审计查询。
 * 点 allowClear 清空属于明确意图，立即提交。
 */
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
}) => {
  const appliedByKey: Record<AuditFilterKey, string> = {
    action: actionFilter,
    actorUserId: actorFilter,
    batchCorrelationId: batchFilter,
    resourceId: resourceIdFilter,
    resourceType: resourceTypeFilter,
    targetUserId: targetFilter,
  };
  const [drafts, setDrafts] = useState<Record<AuditFilterKey, string>>(appliedByKey);

  // 外部重置（如「检索该批次」回填 batchCorrelationId）要同步回草稿，否则输入框残留旧词。
  // 按 key 局部合并：只回写本轮真正变化的筛选项——整表回滚会把其他输入框里
  // 未提交的草稿一起吞掉（例如正打 A 框时点了 B 框的清空叉，B 的立即提交
  // 会触发本 effect，A 的半截草稿不应丢失）。
  const appliedRef = useRef(appliedByKey);
  useEffect(() => {
    const previous = appliedRef.current;
    appliedRef.current = appliedByKey;
    setDrafts((current) => {
      let changed = false;
      const next = { ...current };
      for (const key of Object.keys(appliedByKey) as AuditFilterKey[]) {
        if (appliedByKey[key] !== previous[key] && current[key] !== appliedByKey[key]) {
          next[key] = appliedByKey[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedByKey 每次渲染都是新对象，依赖六个具体的筛选值
  }, [actionFilter, actorFilter, batchFilter, resourceIdFilter, resourceTypeFilter, targetFilter]);

  const commit = (filterKey: AuditFilterKey) => {
    const value = drafts[filterKey] ?? '';
    if (value !== appliedByKey[filterKey]) onFilterChange(filterKey, value);
  };

  return (
    <>
      {/* F2：导出动作从筛选组拆出，作为工具条右侧独立操作组
          （AdminToolbar 是 space-between flex，筛选组占满剩余宽度）。 */}
      <Flexbox horizontal align="center" gap={12} style={{ flex: '1 1 520px', flexWrap: 'wrap' }}>
        {TEXT_FILTERS.map(({ filterKey, placeholderKey, placeholder, width }) => (
          <Input
            allowClear
            key={filterKey}
            placeholder={t(placeholderKey, placeholder)}
            style={{ width: `min(${width}px, 100%)` }}
            value={drafts[filterKey] ?? ''}
            onBlur={() => commit(filterKey)}
            onPressEnter={() => commit(filterKey)}
            onChange={(e: { target: { value: string } }) => {
              const value = e.target.value;
              setDrafts((prev) => ({ ...prev, [filterKey]: value }));
              // 清空是明确意图，立即生效；其余按键等回车/失焦。
              if (value === '' && appliedByKey[filterKey] !== '') onFilterChange(filterKey, '');
            }}
          />
        ))}
        <DatePicker.RangePicker
          allowClear
          format="YYYY/MM/DD"
          style={{ width: 'min(260px, 100%)' }}
          value={dateRangeFilter}
          onChange={(values) => onDateRangeChange(values ? [values[0], values[1]] : null)}
        />
      </Flexbox>
      <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
        <Button loading={exporting} onClick={onExport}>
          {t('admin.audit.exportCsv', '导出 CSV')}
        </Button>
      </Flexbox>
    </>
  );
};
