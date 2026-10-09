'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Modal } from '@lobehub/ui/base-ui';
import { Form, message, Tag } from 'antd';
import { Pencil, Plus } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { moduleAppCacheKeys } from './shared/cacheKeys';
import ModulePageState from './shared/ModulePageState';
import {
  ProductFormFields,
  productFormInitialValues,
  type ProductFormValues,
} from './productFormFields';

type ProductType = 'free' | 'one_time' | 'subscription';
type LicenseScope = 'personal' | 'workspace' | 'workspace_seat';
type ProductStatus = 'active' | 'inactive';

type ProductRow = {
  amount: number;
  billingPeriod?: 'monthly' | 'yearly';
  currency: 'CNY' | 'USD';
  licenseScope: LicenseScope;
  metadata?: Record<string, unknown>;
  productId: string;
  productKey: string;
  productType: ProductType;
  promotion?: Record<string, unknown>;
  status: ProductStatus;
  trialDays?: number;
};

type ProductService = Pick<
  typeof adminCommercialService.moduleApps,
  'createProduct' | 'listProducts' | 'updateProduct'
>;

const normalizeOptionalText = (value?: string) => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const normalizeOptionalDecimal = (value?: number) =>
  typeof value === 'number' ? String(value) : undefined;

const ProductManager = memo<{
  appId: string;
  canWrite?: boolean;
  service?: ProductService;
}>(({ appId, canWrite = true, service = adminCommercialService.moduleApps }) => {
  const { t } = useTranslation('common');
  const [form] = Form.useForm<ProductFormValues>();
  const licenseScope = Form.useWatch('licenseScope', form);
  const productType = Form.useWatch('productType', form);
  const [editing, setEditing] = useState<ProductRow>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const key = useMemo(() => moduleAppCacheKeys.products(appId), [appId]);
  const {
    data = [],
    error,
    isLoading,
    mutate: retry,
  } = useClientDataSWR(key, () => service.listProducts({ appId }) as Promise<ProductRow[]>);

  const close = () => {
    setOpen(false);
    setEditing(undefined);
    form.resetFields();
  };

  const add = () => {
    if (!canWrite) return;

    setEditing(undefined);
    form.setFieldsValue(productFormInitialValues);
    setOpen(true);
  };

  const edit = (row: ProductRow) => {
    if (!canWrite) return;

    setEditing(row);
    form.setFieldsValue({
      amount: row.amount,
      billingPeriod: row.billingPeriod,
      currency: row.currency,
      licenseScope: row.licenseScope,
      moduleMultiplier: Number(row.metadata?.moduleMultiplier ?? 1),
      productKey: row.productKey,
      productType: row.productType,
      promotionTitle: typeof row.promotion?.title === 'string' ? row.promotion.title : undefined,
      revenueShareRate: Number(row.metadata?.revenueShareRate ?? 0),
      seatCount: typeof row.metadata?.seatCount === 'number' ? row.metadata.seatCount : undefined,
      status: row.status,
      termsVersion: String(row.metadata?.termsVersion ?? '1'),
      trialDays: row.trialDays ?? 0,
    });
    setOpen(true);
  };

  const save = async (values: ProductFormValues) => {
    if (!canWrite) return;

    setSaving(true);
    const promotionTitle = normalizeOptionalText(values.promotionTitle);
    const price = {
      amount: Number(values.amount),
      ...(values.billingPeriod ? { billingPeriod: values.billingPeriod } : {}),
      currency: values.currency,
      ...(promotionTitle ? { promotion: { title: promotionTitle } } : {}),
      trialDays: values.trialDays ?? 0,
    };
    const moduleMultiplier = normalizeOptionalDecimal(values.moduleMultiplier);
    const revenueShareRate = normalizeOptionalDecimal(values.revenueShareRate);
    const termsVersion = normalizeOptionalText(values.termsVersion);
    try {
      if (editing) {
        await service.updateProduct({
          licenseScope: values.licenseScope,
          moduleMultiplier,
          price,
          productId: editing.productId,
          productType: values.productType,
          revenueShareRate,
          seatCount: values.seatCount,
          status: values.status,
          termsVersion,
        });
      } else {
        await service.createProduct({
          appId,
          licenseScope: values.licenseScope,
          moduleMultiplier,
          price,
          productKey: values.productKey.trim(),
          productType: values.productType,
          revenueShareRate,
          seatCount: values.seatCount,
          termsVersion,
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
        <Button
          disabled={!canWrite}
          icon={<Pencil size={14} />}
          size="small"
          onClick={() => edit(row)}
        >
          {t('moduleApps.admin.products.edit')}
        </Button>
      ),
      title: t('moduleApps.admin.products.actions'),
    },
  ];

  return (
    <Flexbox gap={12}>
      <ModulePageState
        emptyDescription={t('moduleApps.admin.products.emptyDescription')}
        emptyTitle={t('moduleApps.admin.products.emptyTitle')}
        error={error}
        errorDescription={t('moduleApps.admin.products.loadErrorDescription')}
        errorTitle={t('moduleApps.admin.products.loadErrorTitle')}
        isEmpty={!isLoading && !error && data.length === 0}
        loading={isLoading}
        loadingLabel={t('moduleApps.admin.products.loading')}
        retryLabel={t('moduleApps.admin.products.retry')}
        primaryAction={
          canWrite
            ? {
                icon: <Plus size={16} />,
                label: t('moduleApps.admin.products.add'),
                onClick: add,
              }
            : undefined
        }
        onRetry={() => void retry()}
      >
        <Flexbox gap={12}>
          <Flexbox horizontal justify="flex-end">
            <Button disabled={!canWrite} icon={<Plus size={16} />} type="primary" onClick={add}>
              {t('moduleApps.admin.products.add')}
            </Button>
          </Flexbox>
          <InlineTable columns={columns as any} dataSource={data} rowKey="productId" />
        </Flexbox>
      </ModulePageState>
      <Modal
        destroyOnHidden
        footer={null}
        open={open}
        title={t(editing ? 'moduleApps.admin.products.edit' : 'moduleApps.admin.products.add')}
        onCancel={close}
      >
        <ProductFormFields
          canWrite={canWrite}
          editing={editing}
          form={form}
          licenseScope={licenseScope}
          productType={productType}
          saving={saving}
          t={t as any}
          onFinish={(values) => void save(values)}
        />
      </Modal>
    </Flexbox>
  );
});

ProductManager.displayName = 'ProductManager';

export default ProductManager;
