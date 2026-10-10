'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Select, toast } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/validateFields）与 CreditsRechargeModal 的受控表单契约绑定；base-ui Form 为非受控原生表单、base-ui/form 的 FormKit 是语义重写，均无法行为不变替换；FormKit 迁移另行立项。
import { Form, Switch } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { toAdminAtomicCredits } from '@/features/Admin/adminCreditUnits';
import type { AdminDangerousActionEnvelope } from '@/features/Admin/adminDangerousActions';
import AdminUserDetailDrawer from '@/features/Admin/AdminUserDetailDrawer';
import { CreditsRechargeModal, exportCreditAccountsCsv } from '@/features/Admin/Credits/rechargeParts';
import { buildCreditAccountColumns } from '@/features/Admin/Credits/shared';
import {
  AdminPageError,
  AdminPageShell,
  AdminResponsiveTable,
  AdminSection,
  AdminToolbar,
} from '@/features/Admin/layout';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const AdminCreditsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [sort, setSort] = useState<'balance' | 'totalCredited' | 'totalDebited' | 'updatedAt'>(
    'balance',
  );
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [negativeOnly, setNegativeOnly] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [drawerUser, setDrawerUser] = useState<string | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form] = Form.useForm<{ amount: number; userId: string }>();

  const swrKey = useMemo(
    () => ['admin-credit-accounts', sort, order, negativeOnly, cursor] as const,
    [sort, order, negativeOnly, cursor],
  );

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(swrKey, () =>
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
    setExporting(true);
    try {
      const summary = await exportCreditAccountsCsv(
        {
          limit: 5000,
          negativeOnly: negativeOnly || undefined,
          order,
          sort,
        },
        t as any,
      );
      toast.success(summary);
    } catch {
      toast.error(t('admin.credits.exportFailed', '导出失败'));
    } finally {
      setExporting(false);
    }
  };

  const handleRecharge = async (command: AdminDangerousActionEnvelope<'credits.adjust'>) => {
    const normalizedReason = command.reason?.trim();
    if (!normalizedReason) {
      toast.warning(t('admin.adjustCredits.invalid', '请填写调整数量和原因'));
      return;
    }

    setRecharging(true);
    try {
      const values = await form.validateFields();
      await adminCommercialService.adjustCredits(
        {
          amount: toAdminAtomicCredits(values.amount),
          reason: normalizedReason,
          userId: values.userId.trim(),
        },
        command,
      );
      toast.success(t('admin.credits.rechargeSuccess', '积分已充值'));
      setRechargeOpen(false);
      form.resetFields();
      await mutate(swrKey);
    } catch {
      toast.error(t('admin.credits.rechargeFailed', '充值失败'));
    } finally {
      setRecharging(false);
    }
  };

  const columns = buildCreditAccountColumns(t as any, setDrawerUser);

  return (
    <AdminPageShell
      description={t('admin.credits.description', '查看账户积分余额，并在必要时执行受控调整。')}
      title={t('admin.credits.title', '积分账户')}
      width="full"
    >
      <AdminSection
        description={t('admin.credits.resultSummary', '按余额或变动情况筛选账户。')}
        title={t('admin.credits.listTitle', '账户列表')}
      >
        <AdminToolbar>
          <Flexbox
            horizontal
            align="center"
            gap={12}
            style={{ flex: '1 1 520px', flexWrap: 'wrap' }}
          >
            <Select
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
            <Select
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
            <Button
              disabled={isLoading || Boolean(error)}
              type="primary"
              onClick={() => setRechargeOpen(true)}
            >
              {t('admin.credits.recharge', '充值积分')}
            </Button>
            <Button disabled={exporting} loading={exporting} onClick={handleExport}>
              {t('admin.credits.exportCsv', '导出 CSV')}
            </Button>
          </Flexbox>
        </AdminToolbar>

        {error ? (
          <AdminPageError
            description={t('admin.credits.loadFailed', '积分账户加载失败，请重试。')}
            onRetry={refresh}
          />
        ) : !isLoading && items.length === 0 ? (
          <AdminResponsiveTable label={t('admin.credits.tableLabel', '积分账户表')}>
            <InlineTable
              columns={columns as any}
              dataSource={[]}
              loading={false}
              locale={{ emptyText: t('admin.credits.empty', '暂无积分账户') }}
              rowKey="userId"
            />
          </AdminResponsiveTable>
        ) : (
          <AdminResponsiveTable label={t('admin.credits.tableLabel', '积分账户表')}>
            <InlineTable columns={columns as any} dataSource={items} loading={isLoading} rowKey="userId" />
          </AdminResponsiveTable>
        )}

        {data?.nextCursor != null && (
          <Flexbox align="center">
            <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
              {t('admin.credits.loadMore', '加载更多')}
            </Button>
          </Flexbox>
        )}
      </AdminSection>

      <AdminUserDetailDrawer userId={drawerUser} onClose={() => setDrawerUser(null)} />

      <CreditsRechargeModal
        form={form}
        open={rechargeOpen}
        recharging={recharging}
        t={t as any}
        onCancel={() => setRechargeOpen(false)}
        onConfirm={handleRecharge}
      />
    </AdminPageShell>
  );
});

AdminCreditsPage.displayName = 'AdminCreditsPage';

export default AdminCreditsPage;
