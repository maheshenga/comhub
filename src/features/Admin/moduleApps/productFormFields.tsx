'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Input, InputNumber, Select } from '@lobehub/ui/base-ui';
import { Form, type FormInstance, useWatch } from '@lobehub/ui/base-ui/form';
import { Save } from 'lucide-react';

type ProductType = 'free' | 'one_time' | 'subscription';
type LicenseScope = 'personal' | 'workspace' | 'workspace_seat';
type ProductStatus = 'active' | 'inactive';

export type ProductFormValues = {
  amount: number;
  billingPeriod?: 'monthly' | 'yearly';
  currency: 'CNY' | 'USD';
  licenseScope: LicenseScope;
  moduleMultiplier?: number;
  productKey: string;
  productType: ProductType;
  promotionTitle?: string;
  revenueShareRate?: number;
  seatCount?: number;
  status: ProductStatus;
  termsVersion?: string;
  trialDays?: number;
};

export const productFormInitialValues: ProductFormValues = {
  amount: 0,
  currency: 'CNY',
  licenseScope: 'personal',
  moduleMultiplier: 1,
  productKey: '',
  productType: 'one_time',
  revenueShareRate: 0,
  status: 'active',
  termsVersion: '1',
  trialDays: 0,
};

type TFn = (key: any, defaultValue?: any, values?: any) => any;

const typeOptions = (t: TFn) => [
  { label: t('moduleApps.admin.products.type.free'), value: 'free' },
  { label: t('moduleApps.admin.products.type.oneTime'), value: 'one_time' },
  { label: t('moduleApps.admin.products.type.subscription'), value: 'subscription' },
];
const scopeOptions = (t: TFn) => [
  { label: t('moduleApps.admin.products.scope.personal'), value: 'personal' },
  { label: t('moduleApps.admin.products.scope.workspace'), value: 'workspace' },
  { label: t('moduleApps.admin.products.scope.workspaceSeat'), value: 'workspace_seat' },
];

/** 产品表单弹窗体（M5 拆页：从 ProductManager 抽出）。 */
export const ProductFormFields = ({
  canWrite,
  editing,
  form,
  licenseScope,
  productType,
  saving,
  t,
}: {
  canWrite: boolean;
  editing?: { productId: string };
  form: FormInstance<ProductFormValues>;
  licenseScope?: LicenseScope;
  productType?: ProductType;
  saving: boolean;
  t: TFn;
}) => {
  const status = useWatch(form, 'status');

  return (
    <Form<ProductFormValues> form={form} layout="vertical">
      <Form.Field required label={t('moduleApps.admin.products.productKey')} name="productKey">
        <Input disabled={!canWrite || Boolean(editing)} />
      </Form.Field>
      <Flexbox horizontal gap={12}>
        <Form.Field
          label={t('moduleApps.admin.products.type')}
          name="productType"
          style={{ flex: 1 }}
        >
          <Select
            disabled={!canWrite}
            options={typeOptions(t)}
            onChange={(value: ProductType) => {
              if (value === 'free') form.setValue('amount', 0);
              if (value !== 'subscription') form.setValue('billingPeriod', undefined);
            }}
          />
        </Form.Field>
        <Form.Field
          label={t('moduleApps.admin.products.scope')}
          name="licenseScope"
          style={{ flex: 1 }}
        >
          <Select disabled={!canWrite} options={scopeOptions(t)} />
        </Form.Field>
      </Flexbox>
      <Flexbox horizontal gap={12}>
        <Form.Field
          required
          label={t('moduleApps.admin.products.amount')}
          name="amount"
          style={{ flex: 1 }}
        >
          <InputNumber
            disabled={!canWrite || productType === 'free'}
            min={0}
            precision={0}
            step={1}
            style={{ width: '100%' }}
          />
        </Form.Field>
        <Form.Field
          required
          label={t('moduleApps.admin.products.currency')}
          name="currency"
          style={{ flex: 1 }}
        >
          <Select
            disabled={!canWrite}
            options={[
              { label: 'CNY', value: 'CNY' },
              { label: 'USD', value: 'USD' },
            ]}
          />
        </Form.Field>
      </Flexbox>
      <Flexbox horizontal gap={12}>
        <Form.Field
          label={t('moduleApps.admin.products.billingPeriod')}
          name="billingPeriod"
          required={productType === 'subscription'}
          style={{ flex: 1 }}
        >
          <Select
            allowClear
            disabled={!canWrite || productType !== 'subscription'}
            options={[
              { label: t('moduleApps.admin.products.period.monthly'), value: 'monthly' },
              { label: t('moduleApps.admin.products.period.yearly'), value: 'yearly' },
            ]}
          />
        </Form.Field>
        <Form.Field
          label={t('moduleApps.admin.products.trialDays')}
          name="trialDays"
          style={{ flex: 1 }}
        >
          <InputNumber
            disabled={!canWrite}
            max={365}
            min={0}
            precision={0}
            step={1}
            style={{ width: '100%' }}
          />
        </Form.Field>
      </Flexbox>
      <Form.Field label={t('moduleApps.admin.products.promotionTitle')} name="promotionTitle">
        <Input disabled={!canWrite} maxLength={160} />
      </Form.Field>
      <Flexbox horizontal gap={12}>
        <Form.Field
          label={t('moduleApps.admin.products.moduleMultiplier')}
          name="moduleMultiplier"
          style={{ flex: 1 }}
        >
          <InputNumber
            disabled={!canWrite}
            max={100}
            min={0}
            precision={4}
            step={0.0001}
            style={{ width: '100%' }}
          />
        </Form.Field>
        <Form.Field
          label={t('moduleApps.admin.products.revenueShareRate')}
          name="revenueShareRate"
          style={{ flex: 1 }}
        >
          <InputNumber
            disabled={!canWrite}
            max={1}
            min={0}
            precision={4}
            step={0.0001}
            style={{ width: '100%' }}
          />
        </Form.Field>
      </Flexbox>
      <Flexbox horizontal gap={12}>
        <Form.Field
          label={t('moduleApps.admin.products.seatCount')}
          name="seatCount"
          required={licenseScope === 'workspace_seat'}
          style={{ flex: 1 }}
        >
          <InputNumber
            disabled={!canWrite}
            max={100_000}
            min={1}
            precision={0}
            step={1}
            style={{ width: '100%' }}
          />
        </Form.Field>
        <Form.Field
          required
          label={t('moduleApps.admin.products.termsVersion')}
          name="termsVersion"
          style={{ flex: 1 }}
        >
          <Input disabled={!canWrite} maxLength={80} />
        </Form.Field>
      </Flexbox>
      {editing ? (
        <Form.Field
          label={t('moduleApps.admin.products.status')}
          name="status"
          extra={
            status === 'inactive' ? (
              // 停用是影响真实付费动作的状态切换，表单里先说清后果再让管理员提交。
              <span>{t('moduleApps.admin.products.saveInactiveHint')}</span>
            ) : null
          }
        >
          <Select
            disabled={!canWrite}
            options={[
              { label: t('moduleApps.admin.products.status.active'), value: 'active' },
              { label: t('moduleApps.admin.products.status.inactive'), value: 'inactive' },
            ]}
          />
        </Form.Field>
      ) : null}
      <Button
        block
        disabled={!canWrite}
        htmlType="submit"
        icon={<Save size={16} />}
        loading={saving}
        type="primary"
      >
        {t('moduleApps.admin.products.save')}
      </Button>
    </Form>
  );
};
