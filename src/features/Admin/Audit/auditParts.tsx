'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Modal, Tag } from '@lobehub/ui/base-ui';
import { DatePicker, Descriptions, Empty, Input } from 'antd';
import { type ReactNode } from 'react';

export interface AuditRow {
  action: string;
  actorUserId: string | null;
  batchCorrelationId?: string | null;
  createdAt: Date;
  id: string;
  ipAddress: string | null;
  payload: Record<string, unknown> | null;
  resourceId: string | null;
  resourceType: string | null;
  targetUserId: string | null;
}

export const ACTION_COLORS: Record<string, string> = {
  'credits.adjust': 'gold',
  'order.forceSettle': 'green',
  'order.refund': 'red',
  'plan.delete': 'red',
  'plan.setActive': 'blue',
  'plan.update': 'cyan',
  'subscription.forceChange': 'purple',
  'topupPackage.delete': 'red',
  'topupPackage.setActive': 'blue',
  'topupPackage.update': 'cyan',
  'user.ban': 'red',
  'user.setRole': 'purple',
  'user.unban': 'green',
};

/** 批量命令审计 action 归一：*.bulk* 与 *.item 后缀同源聚合。 */
export const isBulkAuditAction = (action: string) => action.includes('.bulk');

/** 从 payload 里读批量任务关联 ID（item 审计与批级审计共享）。 */
export const readBatchCorrelationId = (row: AuditRow): string | null => {
  const direct = (row as { batchCorrelationId?: null | string }).batchCorrelationId;
  if (direct) return direct;
  const fromPayload = row.payload?.batchCorrelationId;
  return typeof fromPayload === 'string' && fromPayload ? fromPayload : null;
};

/** 审计行按 batchCorrelationId 聚合为可展开组（§5.3）；无批次 ID 的行独立成组。 */
export const groupAuditRowsByBatch = (rows: AuditRow[]) => {
  const groups = new Map<string, { batchCorrelationId: null | string; rows: AuditRow[] }>();
  for (const row of rows) {
    const batchCorrelationId = readBatchCorrelationId(row);
    const key = batchCorrelationId ?? `row:${row.id}`;
    const group = groups.get(key) ?? { batchCorrelationId, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
};

export const AuditActionTag = ({ action }: { action: string }) => (
  <Tag color={ACTION_COLORS[action] ?? 'default'}>{action}</Tag>
);

export const renderAuditPayload = (payload: Record<string, unknown> | null): ReactNode =>
  payload ? (
    <pre
      style={{
        fontSize: 12,
        margin: 0,
        maxHeight: 320,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
      }}
    >
      {JSON.stringify(payload, null, 2)}
    </pre>
  ) : (
    '—'
  );

export const AuditDetailModal = ({
  detail,
  onClose,
  title,
}: {
  detail: AuditRow | null;
  onClose: () => void;
  title: string;
}) => (
  <Modal
    footer={null}
    open={!!detail}
    style={{ maxWidth: 'calc(100vw - 32px)' }}
    title={title}
    width={720}
    onCancel={onClose}
  >
    {detail && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="ID">
          <code>{detail.id}</code>
        </Descriptions.Item>
        <Descriptions.Item label="时间">
          {new Date(detail.createdAt).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label="操作">
          <AuditActionTag action={detail.action} />
        </Descriptions.Item>
        <Descriptions.Item label="批量任务">
          {readBatchCorrelationId(detail) ? (
            <code>{readBatchCorrelationId(detail)}</code>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="操作用户">{detail.actorUserId ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="目标用户">{detail.targetUserId ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="资源">
          {detail.resourceType ?? '—'} {detail.resourceId ? `· ${detail.resourceId}` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="IP">{detail.ipAddress ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="载荷（Payload）">{renderAuditPayload(detail.payload)}</Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);

export type AuditFilterKey = 'action' | 'actorUserId' | 'batchCorrelationId' | 'resourceId' | 'resourceType' | 'targetUserId';

export const AuditFilterInputs = ({
  batchFilter,
  onChange,
  t,
}: {
  batchFilter: string;
  onChange: (key: AuditFilterKey, value: string) => void;
  t: (key: any, defaultValue?: any, values?: any) => string;
}) => (
  <Flexbox horizontal align="center" gap={12} style={{ flex: '1 1 520px', flexWrap: 'wrap' }}>
    <Input
      allowClear
      placeholder={t('admin.audit.filter.actor', '操作者用户 ID')}
      style={{ width: 'min(240px, 100%)' }}
      onChange={(e: { target: { value: string } }) => onChange('actorUserId', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.target', '目标用户 ID')}
      style={{ width: 'min(240px, 100%)' }}
      onChange={(e: { target: { value: string } }) => onChange('targetUserId', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.action', '操作（如 user.ban）')}
      style={{ width: 'min(240px, 100%)' }}
      onChange={(e: { target: { value: string } }) => onChange('action', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.resourceType', '资源类型')}
      style={{ width: 'min(180px, 100%)' }}
      onChange={(e: { target: { value: string } }) => onChange('resourceType', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.resourceId', '资源 ID')}
      style={{ width: 'min(240px, 100%)' }}
      onChange={(e: { target: { value: string } }) => onChange('resourceId', e.target.value)}
    />
    <Input
      allowClear
      placeholder={t('admin.audit.filter.batch', '批量任务 ID（batchCorrelationId）')}
      style={{ width: 'min(280px, 100%)' }}
      value={batchFilter}
      onChange={(e: { target: { value: string } }) => onChange('batchCorrelationId', e.target.value)}
    />
    <DatePicker.RangePicker
      allowClear
      format="YYYY/MM/DD"
      style={{ width: 'min(260px, 100%)' }}
    />
  </Flexbox>
);

export const BulkAuditGroupSummary = ({
  group,
  onFilterBatch,
  t,
}: {
  group: { batchCorrelationId: null | string; rows: AuditRow[] };
  onFilterBatch: (batchCorrelationId: string) => void;
  t: (key: any, defaultValue?: any, values?: any) => string;
}) => {
  if (!group.batchCorrelationId || group.rows.length < 2) return null;
  const failed = group.rows.filter(
    (row) => row.payload?.result === 'failed' || row.payload?.error,
  ).length;

  return (
    <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
      <Tag color="geekblue">
        {t('admin.audit.batchGroup', '批量任务 {{count}} 条', { count: group.rows.length })}
      </Tag>
      {failed > 0 ? (
        <Tag color="red">
          {t('admin.audit.batchGroupFailed', '失败 {{count}} 条', { count: failed })}
        </Tag>
      ) : null}
      <Button
        size="small"
        onClick={() => onFilterBatch(group.batchCorrelationId!)}
      >
        {t('admin.audit.batchGroupFilter', '检索该批次')}
      </Button>
    </Flexbox>
  );
};

export const AuditEmptyState = ({ description }: { description: string }) => (
  <Empty description={description} />
);

export const escapeAuditCsv = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
};
