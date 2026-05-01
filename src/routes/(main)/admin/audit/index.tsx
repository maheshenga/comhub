'use client';

import { Button, Descriptions, Empty, Input, Modal, Tag, message } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import InlineTable from '@/components/InlineTable';
import AdminUserDetailDrawer from '@/features/Admin/AdminUserDetailDrawer';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const ACTION_COLORS: Record<string, string> = {
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

interface AuditRow {
  action: string;
  actorUserId: string | null;
  createdAt: Date;
  id: string;
  ipAddress: string | null;
  payload: Record<string, unknown> | null;
  resourceId: string | null;
  resourceType: string | null;
  targetUserId: string | null;
}

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
};

const downloadCsv = (rows: AuditRow[]) => {
  const header = [
    'createdAt',
    'action',
    'actorUserId',
    'targetUserId',
    'resourceType',
    'resourceId',
    'ipAddress',
    'payload',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.createdAt).toISOString(),
        r.action,
        r.actorUserId,
        r.targetUserId,
        r.resourceType,
        r.resourceId,
        r.ipAddress,
        r.payload,
      ]
        .map(escapeCsv)
        .join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `admin-audit-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.csv`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminAuditPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [actorFilter, setActorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [cursor, setCursor] = useState(0);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [drawerUser, setDrawerUser] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const swrKey = useMemo(
    () => ['admin-audit', actorFilter, targetFilter, actionFilter, cursor] as const,
    [actorFilter, targetFilter, actionFilter, cursor],
  );

  const { data, isLoading } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listAudit({
      action: actionFilter || undefined,
      actorUserId: actorFilter || undefined,
      cursor,
      limit: 50,
      targetUserId: targetFilter || undefined,
    }),
  );

  const items = (data?.items ?? []) as AuditRow[];

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminCommercialService.exportAudit({
        action: actionFilter || undefined,
        actorUserId: actorFilter || undefined,
        limit: 5000,
        targetUserId: targetFilter || undefined,
      });
      downloadCsv(res.items as AuditRow[]);
      message.success(t('admin.audit.exportSuccess', `Exported ${res.items.length} rows`));
    } catch {
      message.error(t('admin.audit.exportFailed', 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: Date) => new Date(v).toLocaleString(),
      title: t('admin.audit.col.time', 'Time'),
      width: 180,
    },
    {
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => <Tag color={ACTION_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.audit.col.action', 'Action'),
    },
    {
      dataIndex: 'actorUserId',
      key: 'actor',
      render: (v: string | null) =>
        v ? (
          <a onClick={(e) => { e.stopPropagation(); setDrawerUser(v); }}>
            <code>{v.slice(0, 8)}</code>
          </a>
        ) : (
          '—'
        ),
      title: t('admin.audit.col.actor', 'Actor'),
    },
    {
      dataIndex: 'targetUserId',
      key: 'target',
      render: (v: string | null) =>
        v ? (
          <a onClick={(e) => { e.stopPropagation(); setDrawerUser(v); }}>
            <code>{v.slice(0, 8)}</code>
          </a>
        ) : (
          '—'
        ),
      title: t('admin.audit.col.target', 'Target'),
    },
    {
      dataIndex: 'resourceType',
      key: 'resourceType',
      render: (v: string | null) => v ?? '—',
      title: t('admin.audit.col.resourceType', 'Resource'),
    },
    {
      dataIndex: 'resourceId',
      key: 'resourceId',
      render: (v: string | null) => (v ? <code>{v.slice(0, 16)}</code> : '—'),
      title: t('admin.audit.col.resourceId', 'Resource ID'),
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
      title: t('admin.audit.col.payload', 'Payload'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox align="center" gap={12} horizontal>
        <Input
          allowClear
          onChange={(e) => {
            setActorFilter(e.target.value);
            setCursor(0);
          }}
          placeholder={t('admin.audit.filter.actor', 'Actor user ID')}
          style={{ width: 240 }}
          value={actorFilter}
        />
        <Input
          allowClear
          onChange={(e) => {
            setTargetFilter(e.target.value);
            setCursor(0);
          }}
          placeholder={t('admin.audit.filter.target', 'Target user ID')}
          style={{ width: 240 }}
          value={targetFilter}
        />
        <Input
          allowClear
          onChange={(e) => {
            setActionFilter(e.target.value);
            setCursor(0);
          }}
          placeholder={t('admin.audit.filter.action', 'Action (e.g. user.ban)')}
          style={{ width: 240 }}
          value={actionFilter}
        />
        <Button loading={exporting} onClick={handleExport}>
          {t('admin.audit.exportCsv', 'Export CSV')}
        </Button>
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.audit.empty', 'No audit logs')} />
      ) : (
        <InlineTable
          columns={columns}
          dataSource={items}
          loading={isLoading}
          onRow={(record) => ({
            onClick: () => setDetail(record as AuditRow),
            style: { cursor: 'pointer' },
          })}
          rowKey="id"
        />
      )}

      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
            {t('admin.audit.loadMore', 'Load More')}
          </Button>
        </Flexbox>
      )}

      <Modal
        footer={null}
        onCancel={() => setDetail(null)}
        open={!!detail}
        title={t('admin.audit.detail.title', 'Audit Log Detail')}
        width={720}
      >
        {detail && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">
              <code>{detail.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label="Time">
              {new Date(detail.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Action">
              <Tag color={ACTION_COLORS[detail.action] ?? 'default'}>{detail.action}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Actor">{detail.actorUserId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Target">{detail.targetUserId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Resource">
              {detail.resourceType ?? '—'} {detail.resourceId ? `· ${detail.resourceId}` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="IP">{detail.ipAddress ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Payload">
              <pre
                style={{
                  fontSize: 12,
                  margin: 0,
                  maxHeight: 320,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {detail.payload ? JSON.stringify(detail.payload, null, 2) : '—'}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <AdminUserDetailDrawer onClose={() => setDrawerUser(null)} userId={drawerUser} />
    </Flexbox>
  );
});

AdminAuditPage.displayName = 'AdminAuditPage';

export default AdminAuditPage;
