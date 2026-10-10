'use client';

import { Button, Input, InputNumber, Modal } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/validateFields）无 base-ui 等价物：base-ui Form 为非受控原生表单、base-ui/form 的 FormKit 是语义重写，无法行为不变替换；与 Redemption/generateForm 同一豁免（FormKit 迁移另行立项）。
import { Form } from 'antd';

import AdminDangerousActionButton from '@/features/Admin/AdminDangerousActionButton';
import type { AdminDangerousActionEnvelope } from '@/features/Admin/adminDangerousActions';
import { adminCommercialService } from '@/services/adminCommercial';

import { escapeCreditCsv } from './shared';

type RechargeFormValues = { amount: number; userId: string };

export type CreditsSortKey = 'balance' | 'totalCredited' | 'totalDebited' | 'updatedAt';

/** 充值积分弹窗（B2 拆分自 routes/(main)/admin/credits，确认信封与字段语义原样迁移）。 */
export const CreditsRechargeModal = (props: {
  form: ReturnType<typeof Form.useForm<RechargeFormValues>>[0];
  onCancel: () => void;
  onConfirm: (command: AdminDangerousActionEnvelope<'credits.adjust'>) => Promise<void>;
  open: boolean;
  recharging: boolean;
  t: (key: any, defaultValue?: any, values?: any) => string;
}) => {
  const { form, t } = props;

  return (
    <Modal
      open={props.open}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      title={t('admin.credits.recharge', '充值积分')}
      footer={[
        <Button key="cancel" onClick={props.onCancel}>
          {t('cancel', '取消')}
        </Button>,
        <AdminDangerousActionButton
          actionId="credits.adjust"
          key="confirm"
          loading={props.recharging}
          type="primary"
          onConfirm={props.onConfirm}
        >
          {t('admin.credits.recharge', '充值积分')}
        </AdminDangerousActionButton>,
      ]}
      onCancel={props.onCancel}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t('admin.userId', '用户 ID')} name="userId" rules={[{ required: true }]}>
          <Input placeholder="用户 ID" />
        </Form.Item>
        <Form.Item
          label={t('admin.adjustCredits.amount', '数量（M Credits）')}
          name="amount"
          rules={[{ required: true }]}
        >
          <InputNumber addonAfter={'M'} min={0.000_001} precision={6} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

CreditsRechargeModal.displayName = 'CreditsRechargeModal';

/** 积分账户 CSV 导出请求与文件落盘（B2 拆分：服务调用与导出流程原样迁移）。 */
export const exportCreditAccountsCsv = async (
  params: {
    limit: number;
    negativeOnly?: boolean;
    order: 'asc' | 'desc';
    sort: CreditsSortKey;
  },
  t: (key: any, defaultValue?: any, values?: any) => string,
) => {
  const res = await adminCommercialService.exportCreditAccounts({
    limit: params.limit,
    negativeOnly: params.negativeOnly,
    order: params.order,
    sort: params.sort,
  });
  const header = [
    'userId',
    'balanceAtomic',
    'totalCreditedAtomic',
    'totalDebitedAtomic',
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
        .map(escapeCreditCsv)
        .join(','),
    );
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.download = `admin-credit-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
  return t('admin.credits.exportSuccess', `已导出 ${res.items.length} 行`);
};
