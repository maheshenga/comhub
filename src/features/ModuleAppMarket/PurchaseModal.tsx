'use client';

import type {
  ModuleAppPaymentAttemptStatus,
  PaymentCheckoutAction,
  PaymentCreateResult,
  PaymentMethod,
  PaymentMethodId,
  PaymentProvider,
} from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import {
  ActionIcon,
  Alert,
  Button,
  FloatingSheet,
  Modal,
  QRCode,
  Segmented,
  Tag,
  Text,
} from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { X } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { submitPaymentCheckout } from '@/features/Payments/checkout';
import { useIsMobile } from '@/hooks/useIsMobile';
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
  onCreateOrder: (input: {
    idempotencyKey: string;
    productId: string;
    workspaceId?: string;
  }) => Promise<{ id: string } | void>;
  onCreatePayment?: (input: {
    method?: PaymentMethodId;
    orderId: string;
  }) => Promise<PaymentCreateResult>;
  onInstall?: (input: { appId: string; workspaceId?: string }) => Promise<void>;
  workspaceId?: string;
};

type ModuleAppQuote = {
  currency: string;
  licenseScope?: string;
  price: number;
  promotion?: ModuleAppCatalogItem['promotion'];
};

type ModuleAppPaymentStatus = {
  method: PaymentMethodId | null;
  paymentStatus: ModuleAppPaymentAttemptStatus | null;
  provider: PaymentProvider | null;
  status: string;
};

export const getPaymentStatusRefreshInterval = (data?: ModuleAppPaymentStatus) =>
  data?.status === 'pending' && data.paymentStatus !== 'failed' ? 3000 : 0;

const formatPrice = (currency?: string, price?: number) =>
  currency && typeof price === 'number'
    ? `${currency} ${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
    : '-';

const styles = createStaticStyles(({ css }) => ({
  sheetContent: css`
    overscroll-behavior: contain;

    box-sizing: border-box;
    max-height: 100%;
    padding-block: 8px calc(16px + env(safe-area-inset-bottom));
    padding-inline: 16px;
  `,
}));

const PurchaseModal = memo<PurchaseModalProps>(
  ({
    catalog,
    license,
    loading,
    open,
    order,
    onCancelOrder,
    onClose,
    onCreateOrder,
    onCreatePayment,
    onInstall,
    workspaceId,
  }) => {
    const { t } = useTranslation('common');
    const isMobile = useIsMobile();
    const [error, setError] = useState<string>();
    const [orderIdempotencyKey, setOrderIdempotencyKey] = useState(() =>
      globalThis.crypto.randomUUID(),
    );
    const [checkout, setCheckout] = useState<PaymentCheckoutAction>();
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>();
    const [selectedProductId, setSelectedProductId] = useState<string>();
    const [submitting, setSubmitting] = useState(false);
    const selected = useMemo(
      () => catalog.find((item) => item.productId === selectedProductId) ?? catalog[0],
      [catalog, selectedProductId],
    );
    const quote = useSWR<ModuleAppQuote>(
      open && selected && !license && !['paid', 'pending'].includes(order?.status ?? '')
        ? ['moduleApp.quoteProduct', selected.productId]
        : null,
      () =>
        moduleAppService.quoteProduct({
          productId: selected!.productId,
        }) as Promise<ModuleAppQuote>,
    );
    const paymentMethods = useSWR<PaymentMethod[]>(
      open && !license ? ['moduleApp.getPaymentMethods'] : null,
      () => moduleAppService.getPaymentMethods(),
    );
    const paymentStatus = useSWR<ModuleAppPaymentStatus>(
      open && order?.status === 'pending' ? ['moduleApp.getPaymentStatus', order.id] : null,
      () =>
        moduleAppService.getPaymentStatus({
          orderId: order!.id,
        }) as Promise<ModuleAppPaymentStatus>,
      {
        refreshInterval: getPaymentStatusRefreshInterval,
        revalidateOnFocus: true,
      },
    );

    useEffect(() => {
      if (!selectedProductId && catalog[0]) setSelectedProductId(catalog[0].productId);
    }, [catalog, selectedProductId]);

    useEffect(() => {
      if (open && selected?.productId) setOrderIdempotencyKey(globalThis.crypto.randomUUID());
    }, [open, order?.id, order?.status, selected?.productId, workspaceId]);

    useEffect(() => {
      if (!selectedMethod && paymentMethods.data?.[0]) {
        setSelectedMethod(paymentMethods.data[0].id);
      }
    }, [paymentMethods.data, selectedMethod]);

    useEffect(() => {
      if (paymentStatus.data?.method) setSelectedMethod(paymentStatus.data.method);
    }, [paymentStatus.data?.method]);

    useEffect(() => {
      if (!open || order?.status === 'paid') setCheckout(undefined);
    }, [open, order?.status]);

    const options = catalog.map((item) => ({
      label: item.billingPeriod ?? item.productType,
      value: item.productId,
    }));
    const methodOptions = (paymentMethods.data ?? []).map((item) => ({
      label: t(`moduleApps.purchase.methods.${item.id}`, item.label),
      value: item.id,
    }));
    const pendingOrder = order?.status === 'pending' ? order : null;
    const selectedScope = selected?.licenseScope ?? quote.data?.licenseScope;
    const requiresWorkspace = Boolean(selectedScope && selectedScope !== 'personal');
    const promotion = quote.data?.promotion ?? selected?.promotion;
    const isFree = selected?.productType === 'free';
    const paymentMethodLocked = Boolean(paymentStatus.data?.method || checkout);

    const createPayment = async (orderId: string) => {
      if (!onCreatePayment) return;
      const payment = await onCreatePayment({ method: selectedMethod, orderId });
      const action = submitPaymentCheckout(payment.checkout);
      setCheckout(action.type === 'qrcode' ? action : undefined);
      void paymentStatus.mutate();
    };

    const paymentMethodControl = methodOptions.length > 0 && (
      <Segmented
        block
        disabled={paymentMethodLocked}
        options={methodOptions}
        value={selectedMethod}
        onChange={(value) => {
          setCheckout(undefined);
          setSelectedMethod(value as PaymentMethodId);
        }}
      />
    );

    const qrCode = checkout?.type === 'qrcode' && (
      <Flexbox align="center" gap={8}>
        <QRCode size={220} value={checkout.url} />
        <Text type={'secondary'}>{t('moduleApps.purchase.scanToPay')}</Text>
      </Flexbox>
    );

    const submit = async () => {
      if (!selected) return;
      setError(undefined);
      setSubmitting(true);
      try {
        if (isFree) {
          if (!onInstall) throw new Error('module_app_install_unavailable');
          await onInstall({
            appId: selected.appId,
            ...(requiresWorkspace && workspaceId ? { workspaceId } : {}),
          });
          onClose();
          return;
        }

        const created = await onCreateOrder({
          idempotencyKey: orderIdempotencyKey,
          productId: selected.productId,
          ...(requiresWorkspace && workspaceId ? { workspaceId } : {}),
        });
        if (created?.id) await createPayment(created.id);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'module_app_payment_failed');
      } finally {
        setSubmitting(false);
      }
    };

    const content = (
      <Flexbox gap={16}>
        {license ? (
          <Flexbox gap={8}>
            <Tag color="green">{t('moduleApps.purchase.authorized')}</Tag>
            <Text type={'secondary'}>
              {license.endsAt
                ? t('moduleApps.purchase.validUntil', { date: String(license.endsAt) })
                : t('moduleApps.purchase.perpetual')}
            </Text>
          </Flexbox>
        ) : pendingOrder ? (
          <Flexbox gap={12}>
            {(error || paymentStatus.data?.paymentStatus === 'failed') && (
              <Alert showIcon message={t('moduleApps.purchase.paymentFailed')} type="error" />
            )}
            <Text>{t('moduleApps.purchase.pending')}</Text>
            <Text code>{pendingOrder.id}</Text>
            {paymentMethodControl}
            {qrCode}
            {onCreatePayment && (
              <Button
                disabled={Boolean(checkout)}
                loading={submitting}
                type="primary"
                onClick={async () => {
                  setError(undefined);
                  setSubmitting(true);
                  try {
                    await createPayment(pendingOrder.id);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'module_app_payment_failed');
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {t('moduleApps.purchase.continuePayment')}
              </Button>
            )}
            <Button
              danger
              loading={loading || submitting}
              onClick={() => onCancelOrder(pendingOrder.id)}
            >
              {t('moduleApps.purchase.cancel')}
            </Button>
          </Flexbox>
        ) : order?.status === 'paid' ? (
          <Flexbox gap={8}>
            <Tag color="blue">{t('moduleApps.purchase.paymentConfirmed')}</Tag>
            <Text code>{order.id}</Text>
          </Flexbox>
        ) : !selected ? (
          <Text type={'secondary'}>{t('moduleApps.purchase.noProducts')}</Text>
        ) : (
          <>
            {error && (
              <Alert showIcon message={t('moduleApps.purchase.paymentFailed')} type="error" />
            )}
            {!paymentMethods.isLoading && methodOptions.length === 0 && !isFree && (
              <Alert showIcon message={t('moduleApps.purchase.noPaymentMethods')} type="warning" />
            )}
            {order?.status === 'refunded' && (
              <Tag color="orange">{t('moduleApps.purchase.refunded')}</Tag>
            )}
            {order?.status === 'cancelled' && <Tag>{t('moduleApps.purchase.cancelled')}</Tag>}
            {options.length > 1 && (
              <Segmented
                block
                options={options}
                value={selected?.productId}
                onChange={(value) => setSelectedProductId(String(value))}
              />
            )}
            {!isFree && paymentMethodControl}
            {qrCode}
            <Flexbox horizontal align="center" justify="space-between">
              <Text>{t('moduleApps.purchase.scopeLabel')}</Text>
              <Tag>
                {t(
                  selectedScope === 'personal'
                    ? 'moduleApps.purchase.scope.personal'
                    : 'moduleApps.purchase.scope.workspace',
                )}
              </Tag>
            </Flexbox>
            <Flexbox horizontal align="center" justify="space-between">
              <Text>{t('moduleApps.purchase.serverQuote')}</Text>
              <Text as={'h4'} fontSize={20} style={{ margin: 0 }} weight={600}>
                {formatPrice(
                  quote.data?.currency ?? selected?.currency,
                  quote.data?.price ?? selected?.amount,
                )}
              </Text>
            </Flexbox>
            {requiresWorkspace && !workspaceId && (
              <Text type={'danger'}>{t('moduleApps.purchase.workspaceRequired')}</Text>
            )}
            {promotion?.title && <Tag color="red">{promotion.title}</Tag>}
            {typeof promotion?.discountAmount === 'number' && promotion.discountAmount > 0 && (
              <Text type={'secondary'}>
                {t('moduleApps.purchase.discountAmount', { amount: promotion.discountAmount })}
              </Text>
            )}
            {typeof promotion?.discountPercent === 'number' && promotion.discountPercent > 0 && (
              <Text type={'secondary'}>
                {t('moduleApps.purchase.discountPercent', { percent: promotion.discountPercent })}
              </Text>
            )}
            {promotion?.validUntil && (
              <Text type={'secondary'}>
                {t('moduleApps.purchase.validUntil', { date: promotion.validUntil })}
              </Text>
            )}
            {selected?.trialDays ? (
              <Text type={'secondary'}>
                {t('moduleApps.purchase.trial', { days: selected.trialDays })}
              </Text>
            ) : null}
            <Button
              block
              loading={loading || quote.isLoading || submitting}
              type="primary"
              disabled={
                !selected ||
                (requiresWorkspace && !workspaceId) ||
                (!isFree && methodOptions.length === 0)
              }
              onClick={submit}
            >
              {t(isFree ? 'moduleApps.purchase.install' : 'moduleApps.purchase.payNow')}
            </Button>
          </>
        )}
      </Flexbox>
    );

    if (isMobile) {
      return (
        <FloatingSheet
          dismissible
          maxHeight={720}
          minHeight={320}
          mode="overlay"
          open={open}
          restingHeight={520}
          snapPoints={[520, 720]}
          title={t('moduleApps.purchase.title')}
          variant="elevated"
          headerActions={
            <ActionIcon
              aria-label={t('moduleApps.purchase.close')}
              icon={X}
              title={t('moduleApps.purchase.close')}
              onClick={onClose}
            />
          }
          onOpenChange={(nextOpen) => {
            if (!nextOpen) onClose();
          }}
        >
          <div
            className={styles.sheetContent}
            data-testid="module-app-purchase-content"
            style={{ overflowY: 'auto' }}
          >
            {content}
          </div>
        </FloatingSheet>
      );
    }

    return (
      <Modal
        destroyOnHidden
        footer={null}
        open={open}
        title={t('moduleApps.purchase.title')}
        onCancel={onClose}
      >
        {content}
      </Modal>
    );
  },
);

PurchaseModal.displayName = 'PurchaseModal';

export default PurchaseModal;
