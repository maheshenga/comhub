'use client';

import { Avatar } from '@lobehub/ui';
import { Button, Empty, Input, InputNumber, Modal, Select, Space, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import InlineTable from '@/components/InlineTable';
import { AdminUserDetailDrawer } from '@/features/Admin';
import { useClientDataSWR } from '@/libs/swr';
import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type UserRow = {
  avatar: string | null;
  banned: boolean | null;
  createdAt: Date | null;
  email: string | null;
  fullName: string | null;
  id: string;
  lastActiveAt: Date | null;
  role: string | null;
};

const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'User', value: 'user' },
  { label: 'None', value: '__none__' },
];

const AdminUsersPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [allItems, setAllItems] = useState<UserRow[]>([]);
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const swrKey = ['admin-users', query, cursor];

  const { data, isLoading } = useClientDataSWR(
    swrKey,
    () => adminCommercialService.listUsers({ cursor, limit: 20, query: query || undefined }),
    {
      onSuccess: (res) => {
        if (cursor === 0) {
          setAllItems(res.items as UserRow[]);
        } else {
          setAllItems((prev) => [...prev, ...(res.items as UserRow[])]);
        }
      },
    },
  );

  const handleSearch = (value: string) => {
    setQuery(value);
    setCursor(0);
    setAllItems([]);
  };

  const handleLoadMore = () => {
    if (data?.nextCursor != null) {
      setCursor(data.nextCursor);
    }
  };

  const invalidate = () => {
    setCursor(0);
    setAllItems([]);
    mutate(['admin-users', query, 0]);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setActionLoading(banTarget);
    try {
      await adminCommercialService.banUser({ banReason: banReason || undefined, userId: banTarget });
      message.success(t('admin.ban.success'));
      setBanTarget(null);
      setBanReason('');
      invalidate();
    } catch {
      message.error(t('admin.error.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(userId);
    try {
      await adminCommercialService.unbanUser(userId);
      message.success(t('admin.unban.success'));
      invalidate();
    } catch {
      message.error(t('admin.error.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetRole = async (userId: string, value: string) => {
    setActionLoading(userId + '-role');
    try {
      const role = value === '__none__' ? null : (value as 'admin' | 'user');
      await adminCommercialService.setUserRole({ role, userId });
      message.success(t('admin.setRole.success'));
      invalidate();
    } catch {
      message.error(t('admin.error.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdjustCredits = async () => {
    if (!adjustTarget || !adjustReason.trim() || !adjustAmount) {
      message.warning(t('admin.adjustCredits.invalid', 'Amount and reason are required'));
      return;
    }
    setActionLoading(adjustTarget + '-credits');
    try {
      await adminCommercialService.adjustCredits({
        amount: Math.round(adjustAmount),
        reason: adjustReason,
        userId: adjustTarget,
      });
      message.success(t('admin.adjustCredits.success', 'Credits adjusted'));
      setAdjustTarget(null);
      setAdjustAmount(0);
      setAdjustReason('');
    } catch {
      message.error(t('admin.error.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  const columns: ColumnsType<UserRow> = [
    {
      dataIndex: 'fullName',
      key: 'name',
      render: (name: string | null, row) => (
        <Space>
          <Avatar avatar={row.avatar ?? undefined} size={28} title={name ?? row.email ?? ''} />
          <span>{name ?? '—'}</span>
        </Space>
      ),
      title: t('admin.name'),
    },
    {
      dataIndex: 'email',
      key: 'email',
      render: (v: string | null) => v ?? '—',
      title: t('admin.email'),
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (v: string | null) =>
        v ? <Tag color={v === 'admin' ? 'purple' : 'blue'}>{v}</Tag> : <span>—</span>,
      title: t('admin.role'),
    },
    {
      dataIndex: 'banned',
      key: 'status',
      render: (v: boolean | null) =>
        v ? <Tag color="red">Banned</Tag> : <Tag color="green">Active</Tag>,
      title: t('admin.status'),
    },
    {
      dataIndex: 'createdAt',
      key: 'joined',
      render: (v: Date | null) => (v ? new Date(v).toLocaleDateString() : '—'),
      title: t('admin.joined'),
    },
    {
      dataIndex: 'lastActiveAt',
      key: 'lastActive',
      render: (v: Date | null) => (v ? new Date(v).toLocaleDateString() : '—'),
      title: t('admin.lastActive'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: UserRow) => (
        <Space>
          {row.banned ? (
            <Button
              loading={actionLoading === row.id}
              size="small"
              onClick={() => handleUnban(row.id)}
            >
              {t('admin.unban')}
            </Button>
          ) : (
            <Button
              danger
              loading={actionLoading === row.id}
              size="small"
              onClick={() => setBanTarget(row.id)}
            >
              {t('admin.ban')}
            </Button>
          )}
          <Select
            loading={actionLoading === row.id + '-role'}
            options={ROLE_OPTIONS}
            placeholder={t('admin.setRole')}
            size="small"
            style={{ width: 100 }}
            value={row.role ?? '__none__'}
            onChange={(v) => handleSetRole(row.id, v)}
          />
          <Button
            size="small"
            onClick={() => {
              setAdjustTarget(row.id);
              setAdjustAmount(0);
              setAdjustReason('');
            }}
          >
            {t('admin.adjustCredits', 'Adjust Credits')}
          </Button>
          <Button size="small" onClick={() => setDetailUserId(row.id)}>
            {t('admin.viewDetail', 'Detail')}
          </Button>
        </Space>
      ),
      title: t('admin.actions'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox align="center" gap={12} horizontal>
        <Input.Search
          allowClear
          onSearch={handleSearch}
          placeholder={t('admin.search')}
          style={{ maxWidth: 320 }}
        />
        <Button
          onClick={async () => {
            try {
              const res = await adminCommercialService.exportUsers({ limit: 10_000, query: undefined });
              const header = ['id', 'email', 'username', 'fullName', 'role', 'banned', 'createdAt', 'lastActiveAt'];
              const escape = (v: unknown) => {
                if (v === null || v === undefined) return '';
                const s = typeof v === 'string' ? v : JSON.stringify(v);
                return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
              };
              const lines = [header.join(',')];
              for (const u of res.items as any[]) {
                lines.push(
                  [
                    u.id, u.email, u.username, u.fullName, u.role, u.banned,
                    u.createdAt ? new Date(u.createdAt).toISOString() : '',
                    u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : '',
                  ].map(escape).join(','),
                );
              }
              const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
              const a = document.createElement('a');
              a.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
              a.href = URL.createObjectURL(blob);
              a.click();
              URL.revokeObjectURL(a.href);
              message.success(t('admin.exportSuccess', `Exported ${res.items.length} rows`));
            } catch {
              message.error(t('admin.exportFailed', 'Export failed'));
            }
          }}
        >
          {t('admin.exportCsv', 'Export CSV')}
        </Button>
      </Flexbox>
      <InlineTable
        columns={columns as any}
        dataSource={allItems}
        loading={isLoading && cursor === 0}
        locale={{ emptyText: <Empty description={t('admin.noData')} /> }}
        rowKey="id"
      />
      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading && cursor > 0} onClick={handleLoadMore}>
            Load More
          </Button>
        </Flexbox>
      )}
      <Modal
        open={!!banTarget}
        title={t('admin.ban')}
        onCancel={() => {
          setBanTarget(null);
          setBanReason('');
        }}
        onOk={handleBan}
      >
        <Input.TextArea
          placeholder={t('admin.ban.reason')}
          rows={3}
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
      </Modal>
      <Modal
        confirmLoading={actionLoading === (adjustTarget ?? '') + '-credits'}
        open={!!adjustTarget}
        title={t('admin.adjustCredits', 'Adjust Credits')}
        onCancel={() => {
          setAdjustTarget(null);
          setAdjustAmount(0);
          setAdjustReason('');
        }}
        onOk={handleAdjustCredits}
      >
        <Flexbox gap={12}>
          <Flexbox gap={4}>
            <div>{t('admin.adjustCredits.amount', 'Amount (positive = credit, negative = debit)')}</div>
            <InputNumber
              onChange={(v) => setAdjustAmount(Number(v ?? 0))}
              style={{ width: '100%' }}
              value={adjustAmount}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <div>{t('admin.adjustCredits.reason', 'Reason')}</div>
            <Input.TextArea
              onChange={(e) => setAdjustReason(e.target.value)}
              rows={3}
              value={adjustReason}
            />
          </Flexbox>
        </Flexbox>
      </Modal>
      <AdminUserDetailDrawer onClose={() => setDetailUserId(null)} userId={detailUserId} />
    </Flexbox>
  );
});

AdminUsersPage.displayName = 'AdminUsersPage';

export default AdminUsersPage;
