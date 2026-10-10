'use client';

import { Plans } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Modal } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/Form.Item name+rules/valuePropName）与字段控件（Input/InputNumber/Switch 的 onChange 受控语义）绑定，无 base-ui 等价物：base-ui Form 为非受控原生表单、base-ui/form 的 FormKit 是语义重写，无法行为不变替换；与 Redemption/generateForm 同一豁免（FormKit 迁移另行立项）。
import { Form, Input, InputNumber, Select, Switch } from 'antd';

import { ADMIN_PLANS_SWR_KEY, type PlanFormValues, type PlanRow } from './shared';

const PLAN_OPTIONS = Object.values(Plans).map((plan) => ({
  label: plan,
  value: plan,
}));

/** 套餐编辑弹窗（B2 拆分自 routes/(main)/admin/plans，字段、文案与提交语义原样迁移）。 */
export const PlanEditModal = (props: {
  editing: Partial<PlanRow> | null;
  form: ReturnType<typeof Form.useForm<PlanFormValues>>[0];
  onCancel: () => void;
  onSave: () => void;
  submitting: boolean;
  t: (key: any, defaultValue?: any, values?: any) => string;
}) => {
  const { form, t } = props;

  return (
    <Modal
      confirmLoading={props.submitting}
      open={!!props.editing}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      width={600}
      title={
        props.editing?.plan
          ? t('admin.plans.modal.edit', '编辑套餐')
          : t('admin.plans.modal.create', '新建套餐')
      }
      onCancel={props.onCancel}
      onOk={props.onSave}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('admin.plans.field.key', '套餐键名')}
          name="plan"
          rules={[{ required: true }]}
        >
          <Select
            disabled={!!props.editing?.plan}
            options={PLAN_OPTIONS}
            placeholder={t('admin.plans.field.keyPlaceholder', '请选择一个内置支持的套餐键名')}
          />
        </Form.Item>
        <Form.Item
          label={t('admin.plans.field.name', '显示名称')}
          name="displayName"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Flexbox horizontal gap={12} wrap="wrap">
          <Form.Item
            label={t('admin.plans.field.monthlyCredits', '每月积分')}
            name="monthlyCredits"
            style={{ flex: 1 }}
          >
            <InputNumber addonAfter={'M'} min={0} precision={6} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.currency', '币种')}
            name="currency"
            style={{ width: 120 }}
          >
            <Input />
          </Form.Item>
        </Flexbox>
        <Flexbox horizontal gap={12} wrap="wrap">
          <Form.Item
            label={t('admin.plans.field.monthly', '月付价格')}
            name="monthlyPrice"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.yearly', '年付价格')}
            name="yearlyPrice"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </Flexbox>
        <Flexbox horizontal gap={12} wrap="wrap">
          <Form.Item
            extra={t('admin.plans.field.oneTimeHint', '留空时前台不展示一次性周期。')}
            label={t('admin.plans.field.oneTime', '一次性价格')}
            name="oneTimePrice"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            extra={t('admin.plans.field.lifetimeHint', '留空时前台不展示终身周期。')}
            label={t('admin.plans.field.lifetime', '终身价格')}
            name="lifetimePrice"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </Flexbox>
        <Form.Item
          extra={t('admin.plans.field.featuresHint', '每行一条')}
          label={t('admin.plans.field.features', '权益说明')}
          name="features"
        >
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item
          label={t('admin.plans.field.purchaseUrl', '购买链接')}
          name="purchaseUrl"
          extra={t(
            'admin.plans.field.purchaseUrlHint',
            '用户在套餐页点击“升级”时会打开该链接，仅支持 http/https。',
          )}
        >
          <Input placeholder="https://..." />
        </Form.Item>
        <Flexbox horizontal gap={12} wrap="wrap">
          <Form.Item
            label={t('admin.plans.field.badge', '套餐徽标')}
            name="badge"
            style={{ flex: 1 }}
          >
            <Input placeholder={t('admin.plans.field.badgePlaceholder', '最受欢迎')} />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.yearlyDiscountLabel', '年付优惠文案')}
            name="yearlyDiscountLabel"
            style={{ flex: 1 }}
          >
            <Input placeholder={t('admin.plans.field.yearlyDiscountPlaceholder', '优惠 20%')} />
          </Form.Item>
        </Flexbox>
        <Form.Item
          extra={t('admin.plans.field.comparisonNoteHint', '展示在用户端套餐对比表中。')}
          label={t('admin.plans.field.comparisonNote', '套餐对比说明')}
          name="comparisonNote"
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        <Flexbox horizontal gap={12} wrap="wrap">
          <Form.Item
            extra={t('admin.plans.field.storageQuotaHint', '留空表示不限；0 表示禁止上传。')}
            label={t('admin.plans.field.storageQuotaMb', '存储空间上限 MB')}
            name="storageQuotaMb"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.vectorQuota', '向量条数上限')}
            name="vectorQuota"
            style={{ flex: 1 }}
            extra={t(
              'admin.plans.field.vectorQuotaHint',
              '留空表示不限；按 embeddings 记录条数计算。',
            )}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Flexbox>
        <Flexbox horizontal gap={12} wrap="wrap">
          <Form.Item
            label={t('admin.plans.field.pptEnabled', '允许 PPT 创作')}
            name="pptEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            extra={t('admin.plans.field.pptMonthlyQuotaHint', '留空表示不限制。')}
            label={t('admin.plans.field.pptMonthlyQuota', 'PPT 月生成次数')}
            name="pptMonthlyQuota"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.pptCreditCost', '每次成功生成扣除积分')}
            name="pptCreditCost"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Flexbox>
        <Flexbox horizontal gap={12} wrap="wrap">
          <Form.Item
            label={t('admin.plans.field.sortOrder', '排序值')}
            name="sortOrder"
            style={{ flex: 1 }}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('admin.plans.field.active', '启用')}
            name="isActive"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Flexbox>
      </Form>
    </Modal>
  );
};

PlanEditModal.displayName = 'PlanEditModal';

export { ADMIN_PLANS_SWR_KEY };
