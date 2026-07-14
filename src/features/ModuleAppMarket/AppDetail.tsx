import { Flexbox } from '@lobehub/ui';
import { Button, Descriptions, Spin, Tag, Typography } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import useSWR from 'swr';

import { moduleAppService } from '@/services/moduleApp';

import PurchaseModal, { type ModuleAppCatalogItem } from './PurchaseModal';

type ModuleAppDetailData = {
  actions: unknown[];
  category: string;
  description?: string;
  displayName: string;
  id: string;
  installed?: boolean;
  source?: string;
  version?: string;
};

type ModuleAppPaymentData = { body: string; outTradeNo: string };

type ModuleAppLicenseData = {
  endsAt?: Date | string | null;
  status?: string;
};

type ModuleAppOrderData = {
  appId: string;
  id: string;
  status: 'cancelled' | 'paid' | 'pending' | 'refunded';
  workspaceId?: null | string;
};

const isOrderInScope = (
  order: ModuleAppOrderData,
  appId?: string,
  workspaceId?: string,
) =>
  order.appId === appId &&
  (workspaceId ? order.workspaceId === workspaceId : !order.workspaceId);

export const submitModuleAppPaymentForm = (body: string) => {
  const parsed = new DOMParser().parseFromString(body, 'text/html');
  const sourceForm = parsed.querySelector('form');
  if (!sourceForm) throw new Error('module_app_payment_form_invalid');

  const rawAction = sourceForm.getAttribute('action');
  if (!rawAction || sourceForm.method.toLowerCase() !== 'post') {
    throw new Error('module_app_payment_form_invalid');
  }
  const action = new URL(rawAction);
  if (action.protocol !== 'https:' || action.username || action.password) {
    throw new Error('module_app_payment_form_invalid');
  }

  const sourceFields = [...sourceForm.querySelectorAll<HTMLInputElement>('input[name]')];
  if (sourceFields.length === 0 || sourceFields.length > 100) {
    throw new Error('module_app_payment_form_invalid');
  }
  const form = document.createElement('form');
  form.action = action.toString();
  form.method = 'post';
  form.style.display = 'none';
  for (const sourceField of sourceFields) {
    const name = sourceField.name;
    const value = sourceField.value;
    if (!/^[A-Z]\w{0,79}$/i.test(name) || value.length > 100_000) {
      throw new Error('module_app_payment_form_invalid');
    }
    const field = document.createElement('input');
    field.name = name;
    field.type = 'hidden';
    field.value = value;
    form.append(field);
  }
  document.body.append(form);
  form.submit();
};

const ModuleAppDetail = memo(() => {
  const { appId } = useParams();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspaceId') || undefined;
  const { t } = useTranslation('common');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [installationLoading, setInstallationLoading] = useState(false);
  const detail = useSWR<ModuleAppDetailData>(appId ? ['moduleApp.getDetail', appId] : null, () =>
    moduleAppService.getDetail({ appIdOrSlug: appId! }) as Promise<ModuleAppDetailData>,
  );
  const catalog = useSWR<ModuleAppCatalogItem[]>(
    appId ? ['moduleApp.listCatalog', appId] : null,
    () => moduleAppService.listCatalog({ appId }) as Promise<ModuleAppCatalogItem[]>,
  );
  const license = useSWR<ModuleAppLicenseData | null>(
    appId ? ['moduleApp.getLicense', appId, workspaceId] : null,
    () =>
      moduleAppService.getLicense({ appId: appId!, workspaceId }) as Promise<ModuleAppLicenseData | null>,
  );
  const orders = useSWR<ModuleAppOrderData[]>(
    appId ? ['moduleApp.listOrders', appId, workspaceId] : null,
    () => moduleAppService.listOrders({ limit: 100 }) as Promise<ModuleAppOrderData[]>,
    {
      refreshInterval: (data) =>
        data?.some(
          (order) =>
            isOrderInScope(order, detail.data?.id, workspaceId) && order.status === 'pending',
        )
          ? 5000
          : 0,
      revalidateOnFocus: true,
    },
  );
  const scopedCatalog = useMemo(
    () =>
      catalog.data?.filter((item) =>
        workspaceId ? item.licenseScope !== 'personal' : item.licenseScope === 'personal',
      ) ?? [],
    [catalog.data, workspaceId],
  );
  const latestOrder = useMemo(
    () =>
      orders.data?.find((order) => isOrderInScope(order, detail.data?.id, workspaceId)),
    [detail.data?.id, orders.data, workspaceId],
  );
  const licenseData = license.data;
  const licenseLoading = license.isLoading;
  const refreshLicense = license.mutate;
  const commerceLoading = Boolean(catalog.isLoading || licenseLoading || orders.isLoading);

  useEffect(() => {
    if (latestOrder?.status === 'paid' && !licenseData && !licenseLoading) {
      void refreshLicense();
    }
  }, [latestOrder?.status, licenseData, licenseLoading, refreshLicense]);

  if (detail.isLoading) return <Flexbox align="center" justify="center" padding={48}><Spin /></Flexbox>;
  if (detail.error || !detail.data) {
    return <Typography.Text type="danger">{t('moduleApps.market.loadError')}</Typography.Text>;
  }
  const detailData = detail.data;

  const createOrder = async (input: { productId: string; workspaceId?: string }) => {
    const order = (await moduleAppService.createOrder(input)) as ModuleAppOrderData;
    await orders.mutate();
    return order;
  };
  const createPayment = async (input: { orderId: string; subject: string }) => {
    const payment = (await moduleAppService.createPayment(input)) as ModuleAppPaymentData;
    submitModuleAppPaymentForm(payment.body);
  };
  const install = async ({ appId: installAppId }: { appId: string }) => {
    setInstallationLoading(true);
    try {
      await moduleAppService.installPersonal({ appId: installAppId });
      await detail.mutate();
    } finally {
      setInstallationLoading(false);
    }
  };
  const uninstall = async () => {
    if (workspaceId) return;
    setInstallationLoading(true);
    try {
      await moduleAppService.uninstallPersonal({ appId: detailData.id });
      await detail.mutate();
      await refreshLicense();
    } finally {
      setInstallationLoading(false);
    }
  };
  const cancelOrder = async (orderId: string) => {
    await moduleAppService.cancelOrder({ orderId });
    await orders.mutate();
  };

  return (
    <Flexbox data-testid="module-app-detail" gap={20} padding={24}>
      <Flexbox horizontal align="center" justify="space-between">
        <Flexbox gap={4}>
          <Typography.Title level={2} style={{ margin: 0 }}>{detailData.displayName}</Typography.Title>
          <Typography.Text type="secondary">{detailData.description}</Typography.Text>
        </Flexbox>
        {detailData.installed ? (
          <Flexbox horizontal gap={8}>
            <Button
              href={`/apps/${detailData.id}/app${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`}
              type="primary"
            >
              {t('moduleApps.market.open')}
            </Button>
            {!workspaceId && (
              <Button danger loading={installationLoading} onClick={uninstall}>
                {t('moduleApps.market.uninstall')}
              </Button>
            )}
          </Flexbox>
        ) : licenseData && !workspaceId ? (
          <Button loading={installationLoading} type="primary" onClick={() => install({ appId: detailData.id })}>
            {t('moduleApps.purchase.install')}
          </Button>
        ) : (
          <Button
            disabled={commerceLoading}
            loading={commerceLoading}
            type="primary"
            onClick={() => setPurchaseOpen(true)}
          >
            {latestOrder?.status === 'pending'
              ? t('moduleApps.purchase.pending')
              : t('moduleApps.purchase.title')}
          </Button>
        )}
      </Flexbox>
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label={t('moduleApps.market.category')}>{detailData.category}</Descriptions.Item>
        <Descriptions.Item label={t('moduleApps.market.version')}>{detailData.version}</Descriptions.Item>
        <Descriptions.Item label={t('moduleApps.market.source')}><Tag>{detailData.source ?? 'admin'}</Tag></Descriptions.Item>
        <Descriptions.Item label={t('moduleApps.market.actions')}>{detailData.actions.length}</Descriptions.Item>
      </Descriptions>
      <PurchaseModal
        catalog={scopedCatalog}
        license={licenseData}
        loading={orders.isValidating}
        open={purchaseOpen}
        order={latestOrder}
        subject={detailData.displayName}
        workspaceId={workspaceId}
        onCancelOrder={cancelOrder}
        onClose={() => setPurchaseOpen(false)}
        onCreateOrder={createOrder}
        onCreatePayment={createPayment}
        onInstall={install}
      />
    </Flexbox>
  );
});

ModuleAppDetail.displayName = 'ModuleAppDetail';

export default ModuleAppDetail;
