'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Empty, Form, Input, InputNumber, message, Modal, Select, Tag } from 'antd';
import { Pencil, Plus, Save } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type ProductType = 'free' | 'one_time' | 'subscription';
type LicenseScope = 'personal' | 'workspace' | 'workspace_seat';
type ProductStatus = 'active' | 'inactive';

type ProductRow = {
  amount: number;
  billingPeriod?: 'monthly' | 'yearly';
  currency: string;
  licenseScope: LicenseScope;
  metadata?: Record<string, unknown>;
  productId: string;
  productKey: string;
  productType: ProductType;
  promotion?: Record<string, unknown>;
  status: ProductStatus;
  trialDays?: number;
};

type ProductFormValues = {
  amount: number;
  billingPeriod?: 'monthly' | 'yearly';
  currency: string;
  licenseScope: LicenseScope;
  moduleMultiplier?: string;
  productKey: string;
  productType: ProductType;
  promotionTitle?: string;
  revenueShareRate?: string;
  seatCount?: number;
  status: ProductStatus;
  termsVersion?: string;
  trialDays?: number;
};

type ProductService = Pick<
  typeof adminCommercialService.moduleApps,
  'createProduct' | 'listProducts' | 'updateProduct'
>;

const initialValues: ProductFormValues = {
  amount: 0,
  currency: 'CNY',
  licenseScope: 'personal',
  productKey: '',
  productType: 'one_time',
  status: 'active',
  trialDays: 0,
};

const ProductManager = memo<{
  appId?: string;
  service?: ProductService;
}>(({ appId, service = adminCommercialService.moduleApps }) => {
  const { t } = useTranslation('common');
  const [form] = Form.useForm<ProductFormValues>();
  const [editing, setEditing] = useState<ProductRow>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const key = useMemo(() => (appId ? ['admin-module-app-products', appId] : null), [appId]);
  const { data = [], isLoading } = useClientDataSWR(key, () =>
    service.listProducts({ appId: appId! }) as Promise<ProductRow[]>,
  );

  const close = () => {
    setOpen(false);
    setEditing(undefined);
    form.resetFields();
  };

  const edit = (row: ProductRow) => {
    setEditing(row);
    form.setFieldsValue({
      amount: row.amount,
      billingPeriod: row.billingPeriod,
      currency: row.currency,
      licenseScope: row.licenseScope,
      moduleMultiplier: String(row.metadata?.moduleMultiplier ?? '1'),
      productKey: row.productKey,
      productType: row.productType,
      promotionTitle:
        typeof row.promotion?.title === 'string' ? row.promotion.title : undefined,
      revenueShareRate: String(row.metadata?.revenueShareRate ?? '0'),
      seatCount:
        typeof row.metadata?.seatCount === 'number' ? row.metadata.seatCount : undefined,
      status: row.status,
      termsVersion: String(row.metadata?.termsVersion ?? '1'),
      trialDays: row.trialDays ?? 0,
    });
    setOpen(true);
  };

  const save = async (values: ProductFormValues) => {
    if (!appId) return;
    setSaving(true);
    const price = {
      amount: Number(values.amount),
      ...(values.billingPeriod ? { billingPeriod: values.billingPeriod } : {}),
      currency: values.currency.trim().toUpperCase(),
      ...(values.promotionTitle
        ? { promotion: { title: values.promotionTitle.trim() } }
        : {}),
      trialDays: values.trialDays ?? 0,
    };
    try {
      if (editing) {
        await service.updateProduct({
          licenseScope: values.licenseScope,
          moduleMultiplier: values.moduleMultiplier,
          price,
          productId: editing.productId,
          productType: values.productType,
          revenueShareRate: values.revenueShareRate,
          seatCount: values.seatCount,
          status: values.status,
          termsVersion: values.termsVersion,
        });
      } else {
        await service.createProduct({
          appId,
          licenseScope: values.licenseScope,
          moduleMultiplier: values.moduleMultiplier,
          price,
          productKey: values.productKey.trim(),
          productType: values.productType,
          revenueShareRate: values.revenueShareRate,
          seatCount: values.seatCount,
          termsVersion: values.termsVersion,
        });
      }
      await mutate(key);
      message.success(
        t(editing ? 'moduleApps.admin.products.updated' : 'moduleApps.admin.products.created'),
      );
      close();
    } catch {
      message.error(t('moduleApps.admin.products.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { dataIndex: 'productKey', title: t('moduleApps.admin.products.productKey') },
    {
      dataIndex: 'productType',
      render: (value: ProductType) =>
        t(
          value === 'one_time'
            ? 'moduleApps.admin.products.type.oneTime'
            : value === 'free'
              ? 'moduleApps.admin.products.type.free'
              : 'moduleApps.admin.products.type.subscription',
        ),
      title: t('moduleApps.admin.products.type'),
    },
    {
      dataIndex: 'licenseScope',
      render: (value: LicenseScope) =>
        t(
          value === 'workspace_seat'
            ? 'moduleApps.admin.products.scope.workspaceSeat'
            : value === 'personal'
              ? 'moduleApps.admin.products.scope.personal'
              : 'moduleApps.admin.products.scope.workspace',
        ),
      title: t('moduleApps.admin.products.scope'),
    },
    {
      render: (_: unknown, row: ProductRow) => `${row.currency} ${row.amount}`,
      title: t('moduleApps.admin.products.activePrice'),
    },
    {
      render: (_: unknown, row: ProductRow) => (
        <Tag color={row.status === 'active' ? 'green' : 'default'}>
          {t(
            row.status === 'active'
              ? 'moduleApps.admin.products.status.active'
              : 'moduleApps.admin.products.status.inactive',
          )}
        </Tag>
      ),
      title: t('moduleApps.admin.products.status'),
    },
    {
      render: (_: unknown, row: ProductRow) => (
        <Button icon={<Pencil size={14} />} size="small" onClick={() => edit(row)}>
          {t('moduleApps.admin.products.edit')}
        </Button>
      ),
      title: t('moduleApps.admin.products.actions'),
    },
  ];

  if (!appId) return <Empty description={t('moduleApps.admin.products.selectApp')} />;

  return (
    <Flexbox gap={12}>
      <Flexbox horizontal justify="flex-end">
        <Button
          icon={<Plus size={16} />}
          type="primary"
          onClick={() => {
            setEditing(undefined);
            form.setFieldsValue(initialValues);
            setOpen(true);
          }}
        >
          {t('moduleApps.admin.products.add')}
        </Button>
      </Flexbox>
      <InlineTable
        columns={columns as any}
        dataSource={data}
        loading={isLoading}
        rowKey="productId"
      />
      <Modal
        destroyOnHidden
        footer={null}
        open={open}
        title={t(
          editing ? 'moduleApps.admin.products.edit' : 'moduleApps.admin.products.add',
        )}
        onCancel={close}
      >
        <Form<ProductFormValues>
          form={form}
          initialValues={initialValues}
          layout="vertical"
          onFinish={save}
        >
          <Form.Item label={t('moduleApps.admin.products.productKey')} name="productKey" rules={[{ required: true }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Flexbox horizontal gap={12}>
            <Form.Item label={t('moduleApps.admin.products.type')} name="productType" style={{ flex: 1 }}>
              <Select
                options={[
                  { label: t('moduleApps.admin.products.type.free'), value: 'free' },
                  { label: t('moduleApps.admin.products.type.oneTime'), value: 'one_time' },
                  { label: t('moduleApps.admin.products.type.subscription'), value: 'subscription' },
                ]}
              />
            </Form.Item>
            <Form.Item label={t('moduleApps.admin.products.scope')} name="licenseScope" style={{ flex: 1 }}>
              <Select
                options={[
                  { label: t('moduleApps.admin.products.scope.personal'), value: 'personal' },
                  { label: t('moduleApps.admin.products.scope.workspace'), value: 'workspace' },
                  { label: t('moduleApps.admin.products.scope.workspaceSeat'), value: 'workspace_seat' },
                ]}
              />
            </Form.Item>
          </Flexbox>
          <Flexbox horizontal gap={12}>
            <Form.Item label={t('moduleApps.admin.products.amount')} name="amount" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} precision={6} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('moduleApps.admin.products.currency')} name="currency" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input maxLength={16} />
            </Form.Item>
          </Flexbox>
          <Flexbox horizontal gap={12}>
            <Form.Item label={t('moduleApps.admin.products.billingPeriod')} name="billingPeriod" style={{ flex: 1 }}>
              <Select
                allowClear
                options={[
                  { label: t('moduleApps.admin.products.period.monthly'), value: 'monthly' },
                  { label: t('moduleApps.admin.products.period.yearly'), value: 'yearly' },
                ]}
              />
            </Form.Item>
            <Form.Item label={t('moduleApps.admin.products.trialDays')} name="trialDays" style={{ flex: 1 }}>
              <InputNumber max={3650} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Flexbox>
          <Form.Item label={t('moduleApps.admin.products.promotionTitle')} name="promotionTitle">
            <Input maxLength={200} />
          </Form.Item>
          {editing && (
            <Form.Item label={t('moduleApps.admin.products.status')} name="status">
              <Select
                options={[
                  { label: t('moduleApps.admin.products.status.active'), value: 'active' },
                  { label: t('moduleApps.admin.products.status.inactive'), value: 'inactive' },
                ]}
              />
            </Form.Item>
          )}
          <Button block htmlType="submit" icon={<Save size={16} />} loading={saving} type="primary">
            {t('moduleApps.admin.products.save')}
          </Button>
        </Form>
      </Modal>
    </Flexbox>
  );
});

ProductManager.displayName = 'ProductManager';

export default ProductManager;
