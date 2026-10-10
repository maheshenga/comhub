'use client';

import { Tag } from '@lobehub/ui/base-ui';

import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';

type SortKey = 'balance' | 'totalCredited' | 'totalDebited' | 'updatedAt';

export type CreditAccountRow = {
  balance: number;
  currency: string;
  totalCredited: number;
  totalDebited: number;
  updatedAt?: Date;
  userId: string;
};

export type { SortKey };

/** 积分账户 CSV 导出（B2 拆分自 routes/(main)/admin/credits，序列化与文件名原样迁移）。 */
export const escapeCreditCsv = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
};

/** 积分账户列定义（渲染与文案原样迁移）。 */
export const buildCreditAccountColumns = (
  t: (key: any, defaultValue?: any, values?: any) => string,
  setDrawerUser: (userId: string) => void,
) => [
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
      <Tag color={v < 0 ? 'red' : v === 0 ? 'default' : 'green'}>{formatAdminCredits(v)}</Tag>
    ),
    title: t('admin.credits.col.balance', '余额'),
  },
  {
    dataIndex: 'totalCredited',
    key: 'totalCredited',
    render: (v: number) => formatAdminCredits(v),
    title: t('admin.credits.col.credited', '累计增加'),
  },
  {
    dataIndex: 'totalDebited',
    key: 'totalDebited',
    render: (v: number) => formatAdminCredits(v),
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
