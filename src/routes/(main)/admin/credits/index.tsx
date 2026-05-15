'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Empty, Form, Input, InputNumber, message, Modal, Select, Switch, Tag } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatCredits } from '@/business/client/BusinessSettingPages/shared';
import InlineTable from '@/components/InlineTable';
import AdminUserDetailDrawer from '@/features/Admin/AdminUserDetailDrawer';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type SortKey = 'balance' | 'totalCredited' | 'totalDebited' | 'updatedAt';

const escapeCsv = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
};

const AdminCreditsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [sort, setSort] = useState<SortKey>('balance');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [negativeOnly, setNegativeOnly] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [drawerUser, setDrawerUser] = useState<string | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [form] = Form.useForm<{ amount: number; reason: string; userId: string }>();

  const swrKey = useMemo(
    () => ['admin-credit-accounts', sort, order, negativeOnly, cursor] as const,
    [sort, order, negativeOnly, cursor],
  );

  const { data, isLoading } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listCreditAccounts({
      cursor,
      limit: 50,
      negativeOnly: negativeOnly || undefined,
      order,
      sort,
    }),
  );

  const items = data?.items ?? [];

  const handleExport = async () => {
    try {
      const res = await adminCommercialService.listCreditAccounts({
        limit: 200,
        negativeOnly: negativeOnly || undefined,
        order,
        sort,
      });
      const header = [
        'userId',
        'balance',
        'totalCredited',
        'totalDebited',
        'currency',
        'updatedAt',
      ];
      const rows = [header.join(',')];
      for (const r of res.items as any[]) {
        rows.push(
          [
            r.userId,
            r.balance,
            r.totalCredited,
            r.totalDebited,
            r.currency,
            r.updatedAt ? new Date(r.updatedAt).toISOString() : '',
          ]
            .map(escapeCsv)
            .join(','),
        );
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.download = `admin-credit-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
      message.success(t('admin.credits.exportSuccess', `已导出 ${res.items.length} 行`));
    } catch {
      message.error(t('admin.credits.exportFailed', '导出失败'));
    }
  };

  const handleRecharge = async () => {
    setRecharging(true);
    try {
      const values = await form.validateFields();
      await adminCommercialService.adjustCredits({
        amount: values.amount,
        reason: values.reason,
        userId: values.userId.trim(),
      });
      message.success(t('admin.credits.rechargeSuccess', '积分已充值'));
      setRechargeOpen(false);
      form.resetFields();
      await mutate(swrKey);
    } catch {
      message.error(t('admin.credits.rechargeFailed', '充值失败'));
    } finally {
      setRecharging(false);
    }
  };

  const columns = [
    {
      dataIndex: 'userId',
      key: 'userId',
      render: (v: string) => (
        <a onClick={() => setDrawerUser(v)}>
          <code>{v.slice(0, 12)}</code>
        </a>
      ),
      title: t('admin.credits.col.user', '用户'),
    },
    {
      dataIndex: 'balance',
      key: 'balance',
      render: (v: number) => (
        <Tag color={v < 0 ? 'red' : v === 0 ? 'default' : 'green'}>{formatCredits(v)}</Tag>
      ),
      title: t('admin.credits.col.balance', '余额'),
    },
    {
      dataIndex: 'totalCredited',
      key: 'totalCredited',
      render: (v: number) => formatCredits(v),
      title: t('admin.credits.col.credited', '累计增加'),
    },
    {
      dataIndex: 'totalDebited',
      key: 'totalDebited',
      render: (v: number) => formatCredits(v),
      title: t('admin.credits.col.debited', '累计扣减'),
    },
    {
      dataIndex: 'currency',
      key: 'currency',
      title: t('admin.credits.col.currency', '币种'),
    },
    {
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: Date) => (v ? new Date(v).toLocaleString() : '—'),
      title: t('admin.credits.col.updated', '更新时间'),
      width: 180,
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" gap={12}>
        <Select<SortKey>
          style={{ width: 180 }}
          value={sort}
          options={[
            { label: t('admin.credits.sort.balance', '余额'), value: 'balance' },
            { label: t('admin.credits.sort.credited', '累计增加'), value: 'totalCredited' },
            { label: t('admin.credits.sort.debited', '累计扣减'), value: 'totalDebited' },
            { label: t('admin.credits.sort.updated', '更新时间'), value: 'updatedAt' },
          ]}
          onChange={(v: 'balance' | 'totalCredited' | 'totalDebited' | 'updatedAt') => {
            setSort(v);
            setCursor(0);
          }}
        />
        <Select<'asc' | 'desc'>
          style={{ width: 100 }}
          value={order}
          options={[
            { label: t('admin.credits.order.desc', '降序'), value: 'desc' },
            { label: t('admin.credits.order.asc', '升序'), value: 'asc' },
          ]}
          onChange={(v: 'asc' | 'desc') => {
            setOrder(v);
            setCursor(0);
          }}
        />
        <Flexbox horizontal align="center" gap={6}>
          <Switch
            checked={negativeOnly}
            onChange={(v: boolean) => {
              setNegativeOnly(v);
              setCursor(0);
            }}
          />
          <span>{t('admin.credits.negativeOnly', '只看负余额')}</span>
        </Flexbox>
        <Button type="primary" onClick={() => setRechargeOpen(true)}>
          {t('admin.credits.recharge', '充值积分')}
        </Button>
        <Button onClick={handleExport}>{t('admin.credits.exportCsv', '导出 CSV')}</Button>
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.credits.empty', '暂无积分账户')} />
      ) : (
        <InlineTable columns={columns} dataSource={items} loading={isLoading} rowKey="userId" />
      )}

      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
            {t('admin.credits.loadMore', '加载更多')}
          </Button>
        </Flexbox>
      )}

      <AdminUserDetailDrawer userId={drawerUser} onClose={() => setDrawerUser(null)} />

      <Modal
        confirmLoading={recharging}
        open={rechargeOpen}
        title={t('admin.credits.recharge', '充值积分')}
        onCancel={() => setRechargeOpen(false)}
        onOk={handleRecharge}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('admin.userId', '用户 ID')}
            name="userId"
            rules={[{ required: true }]}
          >
            <Input placeholder="用户 ID" />
          </Form.Item>
          <Form.Item
            label={t('admin.adjustCredits.amount', '数量（正数增加，负数扣减）')}
            name="amount"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            initialValue="后台手动充值"
            label={t('admin.adjustCredits.reason', '原因')}
            name="reason"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Flexbox>
  );
});

AdminCreditsPage.displayName = 'AdminCreditsPage';

export default AdminCreditsPage;
