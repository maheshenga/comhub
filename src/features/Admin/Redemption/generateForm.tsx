'use client';

// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules）无 base-ui 等价物：@lobehub/ui/base-ui 的 Form 是非受控原生表单（下一主版本移除），base-ui/form 的 FormKit 是 setValue/getValues 语义重写，无法行为不变替换；FormKit 迁移另行立项。
import { DatePicker, Form, Input, InputNumber, Select } from 'antd';

import { toAdminAtomicCredits } from '@/features/Admin/adminCreditUnits';
import { adminCommercialService } from '@/services/adminCommercial';

type RewardType = 'credits' | 'plan' | 'topup_package';

export type RedemptionGenerateValues = {
  batchId?: string;
  codeLength: number;
  count: number;
  creditsAmount?: number;
  expiresAt?: { toISOString: () => string };
  note?: string;
  planCycle?: string;
  planDurationMonths?: number;
  planKey?: string;
  rewardType: RewardType;
  topupPackageId?: string;
};

export const buildRedemptionGeneratePayload = (
  v: RedemptionGenerateValues,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    codeLength: v.codeLength,
    count: v.count,
    batchId: v.batchId || undefined,
    expiresAt: v.expiresAt ? v.expiresAt.toISOString() : undefined,
    note: v.note || undefined,
    rewardType: v.rewardType,
  };
  if (v.rewardType === 'plan') {
    payload.planCycle = v.planCycle;
    payload.planDurationMonths = v.planDurationMonths;
    payload.planKey = v.planKey;
  } else if (v.rewardType === 'credits') {
    payload.creditsAmount = toAdminAtomicCredits(v.creditsAmount ?? 0);
  } else {
    payload.topupPackageId = v.topupPackageId;
  }

  return payload;
};

export interface RedemptionGenerateFormFieldsProps {
  form: ReturnType<typeof Form.useForm>[0];
  packageOptions: Array<{ label: string; value: string }>;
  planOptions: Array<{ label: string; value: string }>;
  t: (key: any, defaultValue?: any, values?: any) => string;
}

/** 生成兑换码弹窗表单（B2 拆分自 routes/(main)/admin/redemption，字段与文案原样迁移）。 */
export const RedemptionGenerateFormFields = (props: RedemptionGenerateFormFieldsProps) => {
  const { form, t } = props;

  return (
    <Form
      form={form}
      initialValues={{ codeLength: 16, count: 10, rewardType: 'credits' }}
      layout="vertical"
    >
      <Form.Item
        label={t('admin.redemption.field.rewardType', '奖励类型')}
        name="rewardType"
        rules={[{ required: true }]}
      >
        <Select
          options={[
            { label: '积分', value: 'credits' },
            { label: '套餐（Plan）', value: 'plan' },
            { label: '充值套餐', value: 'topup_package' },
          ]}
        />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(p: any, c: any) => p.rewardType !== c.rewardType}>
        {({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => {
          const rt = getFieldValue('rewardType') as RewardType;
          if (rt === 'plan')
            return (
              <>
                <Form.Item
                  label={t('admin.redemption.field.planKey', '套餐')}
                  name="planKey"
                  rules={[{ required: true }]}
                  extra={
                    props.planOptions.length === 0
                      ? t(
                          'admin.redemption.field.planKey.empty',
                          '暂无可用套餐，请先在套餐管理中启用套餐',
                        )
                      : undefined
                  }
                >
                  <Select
                    disabled={props.planOptions.length === 0}
                    options={props.planOptions}
                    placeholder={t(
                      'admin.redemption.field.planKey.placeholder',
                      '请选择兑换后获得的套餐',
                    )}
                  />
                </Form.Item>
                <Form.Item
                  label={t('admin.redemption.field.planCycle', '周期')}
                  name="planCycle"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { label: '月付', value: 'monthly' },
                      { label: '年付', value: 'yearly' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label={t('admin.redemption.field.planDuration', '套餐使用时长（月）')}
                  name="planDurationMonths"
                >
                  <InputNumber max={60} min={1} style={{ width: '100%' }} />
                </Form.Item>
              </>
            );
          if (rt === 'credits')
            return (
              <Form.Item
                label={t('admin.redemption.field.creditsAmount', '赠送积分数量')}
                name="creditsAmount"
                rules={[{ required: true }]}
              >
                <InputNumber
                  addonAfter={'M'}
                  min={0.000_001}
                  precision={6}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            );
          return (
            <Form.Item
              label={t('admin.redemption.field.topupPackageId', '充值套餐')}
              name="topupPackageId"
              rules={[{ required: true }]}
              extra={
                props.packageOptions.length === 0
                  ? t(
                      'admin.redemption.field.topupPackageId.empty',
                      '暂无可用充值套餐，请先创建并启用',
                    )
                  : undefined
              }
            >
              <Select
                disabled={props.packageOptions.length === 0}
                options={props.packageOptions}
                placeholder={t(
                  'admin.redemption.field.topupPackageId.placeholder',
                  '请选择兑换后获得的充值套餐',
                )}
              />
            </Form.Item>
          );
        }}
      </Form.Item>
      <Form.Item label={t('admin.redemption.field.count', '生成数量')} name="count">
        <InputNumber max={1000} min={1} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label={t('admin.redemption.field.codeLength', '兑换码长度')} name="codeLength">
        <InputNumber max={32} min={8} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label={t('admin.redemption.field.expiresAt', '过期时间（可选）')} name="expiresAt">
        <DatePicker showTime style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label={t('admin.redemption.field.batchId', '批次 ID（可选）')} name="batchId">
        <Input />
      </Form.Item>
      <Form.Item label={t('admin.redemption.field.note', '备注（可选）')} name="note">
        <Input.TextArea rows={2} />
      </Form.Item>
    </Form>
  );
};

/** 生成兑换码请求（B2 拆分：服务调用与结果返回原样迁移）。 */
export const generateRedemptionCodes = (payload: Record<string, unknown>) =>
  adminCommercialService.generateRedemptionCodes(payload as any);
