'use client';

import { Tag } from '@lobehub/ui/base-ui';

import type { AuditRow } from '@/features/Admin/Audit/auditParts';
import { isBulkAuditAction, readBatchCorrelationId } from '@/features/Admin/Audit/auditParts';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

/** 审计表列定义（§5.3：批量命令行带「批量」徽标与失败态）。 */
export const buildAuditColumns = ({
  onOpenUser,
  t,
}: {
  onOpenUser: (userId: string) => void;
  t: TFn;
}) => [
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (v: Date) => new Date(v).toLocaleString(),
    title: t('admin.audit.col.time', '时间'),
    width: 180,
  },
  {
    dataIndex: 'action',
    key: 'action',
    render: (v: string, row: AuditRow) => (
      <span>
        {isBulkAuditAction(v) ? <Tag color="geekblue">批量</Tag> : null}
        <Tag color={v.includes('.item') ? 'default' : 'blue'}>{v}</Tag>
        {readBatchCorrelationId(row) && row.payload?.result === 'failed' ? (
          <Tag color="red">失败</Tag>
        ) : null}
      </span>
    ),
    title: t('admin.audit.col.action', '操作'),
  },
  {
    dataIndex: 'actorUserId',
    key: 'actorUserId',
    render: (v: string | null) =>
      v ? (
        <a
          onClick={(e) => {
            e.stopPropagation();
            onOpenUser(v);
          }}
        >
          <code>{v.slice(0, 8)}</code>
        </a>
      ) : (
        '—'
      ),
    title: t('admin.audit.col.actor', '操作者'),
  },
  {
    dataIndex: 'targetUserId',
    key: 'targetUserId',
    render: (v: string | null) =>
      v ? (
        <a
          onClick={(e) => {
            e.stopPropagation();
            onOpenUser(v);
          }}
        >
          <code>{v.slice(0, 8)}</code>
        </a>
      ) : (
        '—'
      ),
    title: t('admin.audit.col.target', '目标用户'),
  },
  {
    dataIndex: 'resourceType',
    key: 'resourceType',
    render: (v: string | null) => v ?? '—',
    title: t('admin.audit.col.resourceType', '资源'),
  },
  {
    dataIndex: 'resourceId',
    key: 'resourceId',
    render: (v: string | null) => (v ? <code>{v.slice(0, 16)}</code> : '—'),
    title: t('admin.audit.col.resourceId', '资源 ID'),
  },
  {
    dataIndex: 'ipAddress',
    key: 'ipAddress',
    render: (v: string | null) => (v ? <code>{v}</code> : '—'),
    title: t('admin.audit.col.ip', 'IP'),
  },
  {
    dataIndex: 'payload',
    key: 'payload',
    render: (v: Record<string, unknown> | null) =>
      v ? (
        <code style={{ fontSize: 11, maxWidth: 300, overflow: 'hidden' }}>
          {JSON.stringify(v).slice(0, 100)}
        </code>
      ) : (
        '—'
      ),
    title: t('admin.audit.col.payload', '载荷（Payload）'),
  },
];
