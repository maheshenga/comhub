'use client';

import { Button, Empty, Select, Switch, Tag, message } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import InlineTable from '@/components/InlineTable';
import { formatCredits } from '@/business/client/BusinessSettingPages/shared';
import AdminUserDetailDrawer from '@/features/Admin/AdminUserDetailDrawer';
import { useClientDataSWR } from '@/libs/swr';
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
      const header = ['userId', 'balance', 'totalCredited', 'totalDebited', 'currency', 'updatedAt'];
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
      message.success(t('admin.credits.exportSuccess', `Exported ${res.items.length} rows`));
    } catch {
      message.error(t('admin.credits.exportFailed', 'Export failed'));
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
      title: t('admin.credits.col.user', 'User'),
    },
    {
      dataIndex: 'balance',
      key: 'balance',
      render: (v: number) => (
        <Tag color={v < 0 ? 'red' : v === 0 ? 'default' : 'green'}>{formatCredits(v)}</Tag>
      ),
      title: t('admin.credits.col.balance', 'Balance'),
    },
    {
      dataIndex: 'totalCredited',
      key: 'totalCredited',
      render: (v: number) => formatCredits(v),
      title: t('admin.credits.col.credited', 'Credited'),
    },
    {
      dataIndex: 'totalDebited',
      key: 'totalDebited',
      render: (v: number) => formatCredits(v),
      title: t('admin.credits.col.debited', 'Debited'),
    },
    {
      dataIndex: 'currency',
      key: 'currency',
      title: t('admin.credits.col.currency', 'Currency'),
    },
    {
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: Date) => (v ? new Date(v).toLocaleString() : '—'),
      title: t('admin.credits.col.updated', 'Updated'),
      width: 180,
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox align="center" gap={12} horizontal>
        <Select<SortKey>
          onChange={(v) => {
            setSort(v);
            setCursor(0);
          }}
          options={[
            { label: t('admin.credits.sort.balance', 'Balance'), value: 'balance' },
            { label: t('admin.credits.sort.credited', 'Total Credited'), value: 'totalCredited' },
            { label: t('admin.credits.sort.debited', 'Total Debited'), value: 'totalDebited' },
            { label: t('admin.credits.sort.updated', 'Updated At'), value: 'updatedAt' },
          ]}
          style={{ width: 180 }}
          value={sort}
        />
        <Select<'asc' | 'desc'>
          onChange={(v) => {
            setOrder(v);
            setCursor(0);
          }}
          options={[
            { label: t('admin.credits.order.desc', 'Desc'), value: 'desc' },
            { label: t('admin.credits.order.asc', 'Asc'), value: 'asc' },
          ]}
          style={{ width: 100 }}
          value={order}
        />
        <Flexbox align="center" gap={6} horizontal>
          <Switch
            checked={negativeOnly}
            onChange={(v) => {
              setNegativeOnly(v);
              setCursor(0);
            }}
          />
          <span>{t('admin.credits.negativeOnly', 'Negative only')}</span>
        </Flexbox>
        <Button onClick={handleExport}>{t('admin.credits.exportCsv', 'Export CSV')}</Button>
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.credits.empty', 'No credit accounts')} />
      ) : (
        <InlineTable columns={columns} dataSource={items} loading={isLoading} rowKey="userId" />
      )}

      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
            {t('admin.credits.loadMore', 'Load More')}
          </Button>
        </Flexbox>
      )}

      <AdminUserDetailDrawer onClose={() => setDrawerUser(null)} userId={drawerUser} />
    </Flexbox>
  );
});

AdminCreditsPage.displayName = 'AdminCreditsPage';

export default AdminCreditsPage;
