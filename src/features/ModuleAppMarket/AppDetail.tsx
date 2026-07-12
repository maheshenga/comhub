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
  source?: string;
  version?: string;
};

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

const ModuleAppDetail = memo(() => {
  const { appId } = useParams();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspaceId') || undefined;
  const { t } = useTranslation('common');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
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

  const createOrder = async (input: { productId: string; workspaceId?: string }) => {
    await moduleAppService.createOrder(input);
    await orders.mutate();
  };
  const cancelOrder = async (orderId: string) => {
    await moduleAppService.cancelOrder({ orderId });
    await orders.mutate();
  };

  return (
    <Flexbox data-testid="module-app-detail" gap={20} padding={24}>
      <Flexbox horizontal align="center" justify="space-between">
        <Flexbox gap={4}>
          <Typography.Title level={2} style={{ margin: 0 }}>{detail.data.displayName}</Typography.Title>
          <Typography.Text type="secondary">{detail.data.description}</Typography.Text>
        </Flexbox>
        {licenseData ? (
          <Button
            href={`/apps/${detail.data.id}/app${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`}
            type="primary"
          >
            {t('moduleApps.market.open')}
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
        <Descriptions.Item label={t('moduleApps.market.category')}>{detail.data.category}</Descriptions.Item>
        <Descriptions.Item label={t('moduleApps.market.version')}>{detail.data.version}</Descriptions.Item>
        <Descriptions.Item label={t('moduleApps.market.source')}><Tag>{detail.data.source ?? 'admin'}</Tag></Descriptions.Item>
        <Descriptions.Item label={t('moduleApps.market.actions')}>{detail.data.actions.length}</Descriptions.Item>
      </Descriptions>
      <PurchaseModal
        catalog={scopedCatalog}
        license={licenseData}
        loading={orders.isValidating}
        open={purchaseOpen}
        order={latestOrder}
        workspaceId={workspaceId}
        onCancelOrder={cancelOrder}
        onClose={() => setPurchaseOpen(false)}
        onCreateOrder={createOrder}
      />
    </Flexbox>
  );
});

ModuleAppDetail.displayName = 'ModuleAppDetail';

export default ModuleAppDetail;
