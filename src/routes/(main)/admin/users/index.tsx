'use client';

import { Avatar, Flexbox } from '@lobehub/ui';
import { Button, Empty, Input, InputNumber, message, Modal, Select, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { AdminUserDetailDrawer } from '@/features/Admin';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type UserRow = {
  avatar: string | null;
  banned: boolean | null;
  createdAt: Date | null;
  email: string | null;
  fullName: string | null;
  id: string;
  lastActiveAt: Date | null;
  phone: string | null;
  role: string | null;
};

const EMPTY_TEXT = '-';

const ROLE_OPTIONS = [
  { label: '管理员（Admin）', value: 'admin' },
  { label: '普通用户（User）', value: 'user' },
  { label: '未设置', value: '__none__' },
];

const roleLabel = (role: string | null) => {
  if (role === 'admin') return '管理员';
  if (role === 'user') return '普通用户';

  return EMPTY_TEXT;
};

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
      await adminCommercialService.banUser({
        banReason: banReason || undefined,
        userId: banTarget,
      });
      message.success(t('admin.ban.success', '用户已封禁'));
      setBanTarget(null);
      setBanReason('');
      invalidate();
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(userId);
    try {
      await adminCommercialService.unbanUser(userId);
      message.success(t('admin.unban.success', '用户已解封'));
      invalidate();
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetRole = async (userId: string, value: string) => {
    setActionLoading(userId + '-role');
    try {
      const role = value === '__none__' ? null : (value as 'admin' | 'user');
      await adminCommercialService.setUserRole({ role, userId });
      message.success(t('admin.setRole.success', '角色已更新'));
      invalidate();
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdjustCredits = async () => {
    if (!adjustTarget || !adjustReason.trim() || !adjustAmount) {
      message.warning(t('admin.adjustCredits.invalid', '请输入积分数量和调整原因'));
      return;
    }
    setActionLoading(adjustTarget + '-credits');
    try {
      await adminCommercialService.adjustCredits({
        amount: Math.round(adjustAmount),
        reason: adjustReason,
        userId: adjustTarget,
      });
      message.success(t('admin.adjustCredits.success', '积分已调整'));
      setAdjustTarget(null);
      setAdjustAmount(0);
      setAdjustReason('');
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
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
          <span>{name ?? EMPTY_TEXT}</span>
        </Space>
      ),
      title: t('admin.name', '姓名'),
    },
    {
      dataIndex: 'email',
      key: 'email',
      render: (v: string | null) => v ?? EMPTY_TEXT,
      title: t('admin.email', '邮箱'),
    },
    {
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string | null) => v ?? EMPTY_TEXT,
      title: t('admin.phone', '手机号'),
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (v: string | null) =>
        v ? (
          <Tag color={v === 'admin' ? 'purple' : 'blue'}>{roleLabel(v)}</Tag>
        ) : (
          <span>{EMPTY_TEXT}</span>
        ),
      title: t('admin.role', '角色'),
    },
    {
      dataIndex: 'banned',
      key: 'status',
      render: (v: boolean | null) =>
        v ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>,
      title: t('admin.status', '状态'),
    },
    {
      dataIndex: 'createdAt',
      key: 'joined',
      render: (v: Date | null) => (v ? new Date(v).toLocaleDateString() : EMPTY_TEXT),
      title: t('admin.joined', '注册时间'),
    },
    {
      dataIndex: 'lastActiveAt',
      key: 'lastActive',
      render: (v: Date | null) => (v ? new Date(v).toLocaleDateString() : EMPTY_TEXT),
      title: t('admin.lastActive', '最近活跃'),
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
              {t('admin.unban', '解封')}
            </Button>
          ) : (
            <Button
              danger
              loading={actionLoading === row.id}
              size="small"
              onClick={() => setBanTarget(row.id)}
            >
              {t('admin.ban', '封禁')}
            </Button>
          )}
          <Select
            loading={actionLoading === row.id + '-role'}
            options={ROLE_OPTIONS}
            placeholder={t('admin.setRole', '设置角色')}
            size="small"
            style={{ width: 132 }}
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
            {t('admin.adjustCredits', '调整积分')}
          </Button>
          <Button size="small" onClick={() => setDetailUserId(row.id)}>
            {t('admin.viewDetail', '详情')}
          </Button>
        </Space>
      ),
      title: t('admin.actions', '操作'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" gap={12}>
        <Input.Search
          allowClear
          placeholder={t('admin.search', '搜索用户')}
          style={{ maxWidth: 320 }}
          onSearch={handleSearch}
        />
        <Button
          onClick={async () => {
            try {
              const res = await adminCommercialService.exportUsers({
                limit: 10_000,
                query: undefined,
              });
              const header = [
                'id',
                'email',
                'username',
                'fullName',
                'phone',
                'role',
                'banned',
                'createdAt',
                'lastActiveAt',
              ];
              const escape = (v: unknown) => {
                if (v === null || v === undefined) return '';
                const s = typeof v === 'string' ? v : JSON.stringify(v);

                return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
              };
              const lines = [header.join(',')];
              for (const u of res.items as any[]) {
                lines.push(
                  [
                    u.id,
                    u.email,
                    u.username,
                    u.fullName,
                    u.phone,
                    u.role,
                    u.banned,
                    u.createdAt ? new Date(u.createdAt).toISOString() : '',
                    u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : '',
                  ]
                    .map(escape)
                    .join(','),
                );
              }
              const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
              const a = document.createElement('a');
              a.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
              a.href = URL.createObjectURL(blob);
              a.click();
              URL.revokeObjectURL(a.href);
              message.success(t('admin.exportSuccess', `已导出 ${res.items.length} 条`));
            } catch {
              message.error(t('admin.exportFailed', '导出失败'));
            }
          }}
        >
          {t('admin.exportCsv', '导出 CSV')}
        </Button>
      </Flexbox>
      <InlineTable
        columns={columns as any}
        dataSource={allItems}
        loading={isLoading && cursor === 0}
        locale={{ emptyText: <Empty description={t('admin.noData', '暂无数据')} /> }}
        rowKey="id"
      />
      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading && cursor > 0} onClick={handleLoadMore}>
            {t('admin.loadMore', '加载更多')}
          </Button>
        </Flexbox>
      )}
      <Modal
        open={!!banTarget}
        title={t('admin.ban', '封禁用户')}
        onOk={handleBan}
        onCancel={() => {
          setBanTarget(null);
          setBanReason('');
        }}
      >
        <Input.TextArea
          placeholder={t('admin.ban.reason', '请输入封禁原因')}
          rows={3}
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
      </Modal>
      <Modal
        confirmLoading={actionLoading === (adjustTarget ?? '') + '-credits'}
        open={!!adjustTarget}
        title={t('admin.adjustCredits', '调整积分')}
        onOk={handleAdjustCredits}
        onCancel={() => {
          setAdjustTarget(null);
          setAdjustAmount(0);
          setAdjustReason('');
        }}
      >
        <Flexbox gap={12}>
          <Flexbox gap={4}>
            <div>{t('admin.adjustCredits.amount', '积分数量（可输入负数扣减）')}</div>
            <InputNumber
              style={{ width: '100%' }}
              value={adjustAmount}
              onChange={(v) => setAdjustAmount(Number(v ?? 0))}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <div>{t('admin.adjustCredits.reason', '原因')}</div>
            <Input.TextArea
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </Flexbox>
        </Flexbox>
      </Modal>
      <AdminUserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId(null)} />
    </Flexbox>
  );
});

AdminUsersPage.displayName = 'AdminUsersPage';

export default AdminUsersPage;
