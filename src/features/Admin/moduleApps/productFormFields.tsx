'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Form, Input, InputNumber, Select } from 'antd';
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
  onFinish,
  productType,
  saving,
  t,
}: {
  canWrite: boolean;
  editing?: { productId: string };
  form: ReturnType<typeof Form.useForm<ProductFormValues>>[0];
  licenseScope?: LicenseScope;
  onFinish: (values: ProductFormValues) => void;
  productType?: ProductType;
  saving: boolean;
  t: TFn;
}) => (
  <Form<ProductFormValues>
    disabled={!canWrite}
    form={form}
    initialValues={productFormInitialValues}
    layout="vertical"
    onFinish={onFinish}
  >
    <Form.Item
      label={t('moduleApps.admin.products.productKey')}
      name="productKey"
      rules={[{ required: true }]}
    >
      <Input disabled={Boolean(editing)} />
    </Form.Item>
    <Flexbox horizontal gap={12}>
      <Form.Item
        label={t('moduleApps.admin.products.type')}
        name="productType"
        style={{ flex: 1 }}
      >
        <Select
          options={typeOptions(t)}
          onChange={(value: ProductType) => {
            if (value === 'free') form.setFieldValue('amount', 0);
            if (value !== 'subscription') form.setFieldValue('billingPeriod', undefined);
          }}
        />
      </Form.Item>
      <Form.Item
        label={t('moduleApps.admin.products.scope')}
        name="licenseScope"
        style={{ flex: 1 }}
      >
        <Select options={scopeOptions(t)} />
      </Form.Item>
    </Flexbox>
    <Flexbox horizontal gap={12}>
      <Form.Item
        label={t('moduleApps.admin.products.amount')}
        name="amount"
        rules={[{ required: true }]}
        style={{ flex: 1 }}
      >
        <InputNumber
          disabled={productType === 'free'}
          min={0}
          precision={0}
          step={1}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item
        label={t('moduleApps.admin.products.currency')}
        name="currency"
        rules={[{ required: true }]}
        style={{ flex: 1 }}
      >
        <Select
          options={[
            { label: 'CNY', value: 'CNY' },
            { label: 'USD', value: 'USD' },
          ]}
        />
      </Form.Item>
    </Flexbox>
    <Flexbox horizontal gap={12}>
      <Form.Item
        label={t('moduleApps.admin.products.billingPeriod')}
        name="billingPeriod"
        rules={[{ required: productType === 'subscription' }]}
        style={{ flex: 1 }}
      >
        <Select
          allowClear
          disabled={productType !== 'subscription'}
          options={[
            { label: t('moduleApps.admin.products.period.monthly'), value: 'monthly' },
            { label: t('moduleApps.admin.products.period.yearly'), value: 'yearly' },
          ]}
        />
      </Form.Item>
      <Form.Item
        label={t('moduleApps.admin.products.trialDays')}
        name="trialDays"
        style={{ flex: 1 }}
      >
        <InputNumber max={365} min={0} precision={0} step={1} style={{ width: '100%' }} />
      </Form.Item>
    </Flexbox>
    <Form.Item label={t('moduleApps.admin.products.promotionTitle')} name="promotionTitle">
      <Input maxLength={160} />
    </Form.Item>
    <Flexbox horizontal gap={12}>
      <Form.Item
        label={t('moduleApps.admin.products.moduleMultiplier')}
        name="moduleMultiplier"
        style={{ flex: 1 }}
      >
        <InputNumber max={100} min={0} precision={4} step={0.0001} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        label={t('moduleApps.admin.products.revenueShareRate')}
        name="revenueShareRate"
        style={{ flex: 1 }}
      >
        <InputNumber max={1} min={0} precision={4} step={0.0001} style={{ width: '100%' }} />
      </Form.Item>
    </Flexbox>
    <Flexbox horizontal gap={12}>
      <Form.Item
        label={t('moduleApps.admin.products.seatCount')}
        name="seatCount"
        rules={[{ required: licenseScope === 'workspace_seat' }]}
        style={{ flex: 1 }}
      >
        <InputNumber max={100_000} min={1} precision={0} step={1} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        label={t('moduleApps.admin.products.termsVersion')}
        name="termsVersion"
        rules={[{ required: true }]}
        style={{ flex: 1 }}
      >
        <Input maxLength={80} />
      </Form.Item>
    </Flexbox>
    {editing ? (
      <Form.Item label={t('moduleApps.admin.products.status')} name="status">
        <Select
          options={[
            { label: t('moduleApps.admin.products.status.active'), value: 'active' },
            { label: t('moduleApps.admin.products.status.inactive'), value: 'inactive' },
          ]}
        />
      </Form.Item>
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
