'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Modal, Segmented, Tag, Typography } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { moduleAppService } from '@/services/moduleApp';

export type ModuleAppCatalogItem = {
  amount: number;
  appId: string;
  billingPeriod?: string;
  currency: string;
  licenseScope: string;
  productId: string;
  productType: string;
  promotion?: {
    discountAmount?: number;
    discountPercent?: number;
    title?: string;
    validUntil?: string;
  };
  trialDays?: number;
};

type PurchaseModalProps = {
  catalog: ModuleAppCatalogItem[];
  license?: { endsAt?: Date | string | null; status?: string } | null;
  loading?: boolean;
  open: boolean;
  order?: { id: string; status: string } | null;
  onCancelOrder: (orderId: string) => Promise<void>;
  onClose: () => void;
  onCreateOrder: (input: { productId: string; workspaceId?: string }) => Promise<void>;
  workspaceId?: string;
};

type ModuleAppQuote = {
  currency: string;
  licenseScope?: string;
  price: number;
  promotion?: ModuleAppCatalogItem['promotion'];
};

const formatPrice = (currency?: string, price?: number) =>
  currency && typeof price === 'number'
    ? `${currency} ${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
    : '-';

const PurchaseModal = memo<PurchaseModalProps>(
  ({ catalog, license, loading, open, order, onCancelOrder, onClose, onCreateOrder, workspaceId }) => {
    const { t } = useTranslation('common');
    const [selectedProductId, setSelectedProductId] = useState<string>();
    const selected = useMemo(
      () => catalog.find((item) => item.productId === selectedProductId) ?? catalog[0],
      [catalog, selectedProductId],
    );
    const quote = useSWR<ModuleAppQuote>(
      open && selected && !license && !['paid', 'pending'].includes(order?.status ?? '')
        ? ['moduleApp.quoteProduct', selected.productId]
        : null,
      () => moduleAppService.quoteProduct({ productId: selected!.productId }) as Promise<ModuleAppQuote>,
    );

    useEffect(() => {
      if (!selectedProductId && catalog[0]) setSelectedProductId(catalog[0].productId);
    }, [catalog, selectedProductId]);

    const options = catalog.map((item) => ({
      label: item.billingPeriod ?? item.productType,
      value: item.productId,
    }));
    const pendingOrder = order?.status === 'pending' ? order : null;
    const selectedScope = selected?.licenseScope ?? quote.data?.licenseScope;
    const requiresWorkspace = Boolean(selectedScope && selectedScope !== 'personal');
    const promotion = quote.data?.promotion ?? selected?.promotion;

    return (
      <Modal
        destroyOnHidden
        footer={null}
        open={open}
        title={t('moduleApps.purchase.title')}
        onCancel={onClose}
      >
        <Flexbox gap={16}>
          {license ? (
            <Flexbox gap={8}>
              <Tag color="green">{t('moduleApps.purchase.authorized')}</Tag>
              <Typography.Text type="secondary">
                {license.endsAt
                  ? t('moduleApps.purchase.validUntil', { date: String(license.endsAt) })
                  : t('moduleApps.purchase.perpetual')}
              </Typography.Text>
            </Flexbox>
          ) : pendingOrder ? (
            <Flexbox gap={12}>
              <Typography.Text>{t('moduleApps.purchase.pending')}</Typography.Text>
              <Typography.Text code>{pendingOrder.id}</Typography.Text>
              <Button
                danger
                loading={loading}
                onClick={() => onCancelOrder(pendingOrder.id)}
              >
                {t('moduleApps.purchase.cancel')}
              </Button>
            </Flexbox>
          ) : order?.status === 'paid' ? (
            <Flexbox gap={8}>
              <Tag color="blue">{t('moduleApps.purchase.paymentConfirmed')}</Tag>
              <Typography.Text code>{order.id}</Typography.Text>
            </Flexbox>
          ) : !selected ? (
            <Typography.Text type="secondary">
              {t('moduleApps.purchase.noProducts')}
            </Typography.Text>
          ) : (
            <>
              {order?.status === 'refunded' && (
                <Tag color="orange">{t('moduleApps.purchase.refunded')}</Tag>
              )}
              {order?.status === 'cancelled' && (
                <Tag>{t('moduleApps.purchase.cancelled')}</Tag>
              )}
              {options.length > 1 && (
                <Segmented
                  block
                  options={options}
                  value={selected?.productId}
                  onChange={(value) => setSelectedProductId(String(value))}
                />
              )}
              <Flexbox horizontal align="center" justify="space-between">
                <Typography.Text>{t('moduleApps.purchase.scopeLabel')}</Typography.Text>
                <Tag>
                  {t(
                    selectedScope === 'personal'
                      ? 'moduleApps.purchase.scope.personal'
                      : 'moduleApps.purchase.scope.workspace',
                  )}
                </Tag>
              </Flexbox>
              <Flexbox horizontal align="center" justify="space-between">
                <Typography.Text>{t('moduleApps.purchase.serverQuote')}</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {formatPrice(
                    quote.data?.currency ?? selected?.currency,
                    quote.data?.price ?? selected?.amount,
                  )}
                </Typography.Title>
              </Flexbox>
              {requiresWorkspace && !workspaceId && (
                <Typography.Text type="danger">
                  {t('moduleApps.purchase.workspaceRequired')}
                </Typography.Text>
              )}
              {promotion?.title && <Tag color="red">{promotion.title}</Tag>}
              {typeof promotion?.discountAmount === 'number' && promotion.discountAmount > 0 && (
                <Typography.Text type="secondary">
                  {t('moduleApps.purchase.discountAmount', { amount: promotion.discountAmount })}
                </Typography.Text>
              )}
              {typeof promotion?.discountPercent === 'number' && promotion.discountPercent > 0 && (
                <Typography.Text type="secondary">
                  {t('moduleApps.purchase.discountPercent', { percent: promotion.discountPercent })}
                </Typography.Text>
              )}
              {promotion?.validUntil && (
                <Typography.Text type="secondary">
                  {t('moduleApps.purchase.validUntil', { date: promotion.validUntil })}
                </Typography.Text>
              )}
              {selected?.trialDays ? (
                <Typography.Text type="secondary">
                  {t('moduleApps.purchase.trial', { days: selected.trialDays })}
                </Typography.Text>
              ) : null}
              <Button
                block
                disabled={!selected || (requiresWorkspace && !workspaceId)}
                loading={loading || quote.isLoading}
                type="primary"
                onClick={() =>
                  selected &&
                  onCreateOrder({
                    productId: selected.productId,
                    ...(requiresWorkspace && workspaceId ? { workspaceId } : {}),
                  })
                }
              >
                {t('moduleApps.purchase.createOrder')}
              </Button>
              <Typography.Text type="secondary">
                {t('moduleApps.purchase.noOnlinePayment')}
              </Typography.Text>
            </>
          )}
        </Flexbox>
      </Modal>
    );
  },
);

PurchaseModal.displayName = 'PurchaseModal';

export default PurchaseModal;
