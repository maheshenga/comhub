import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import useSWR from 'swr';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { MobileStateView } from '@/features/MobileWorkspace/components';
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

const isOrderInScope = (order: ModuleAppOrderData, appId?: string, workspaceId?: string) =>
  order.appId === appId && (workspaceId ? order.workspaceId === workspaceId : !order.workspaceId);

const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;

    & > :where(a, button) {
      min-height: 44px;
    }

    @media (width < 600px) {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;

      & > :where(a, button) {
        width: 100%;
      }
    }
  `,
  description: css`
    margin: 0;

    font-size: 14px;
    line-height: 22px;
    color: ${cssVar.colorTextSecondary};
    overflow-wrap: anywhere;
  `,
  frame: css`
    display: flex;
    flex-direction: column;
    gap: 20px;

    box-sizing: border-box;
    width: 100%;
    max-width: 960px;
    margin-inline: auto;
    padding: 16px;

    @media (width >= 768px) {
      padding: 24px;
    }
  `,
  header: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: start;

    @media (width < 600px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  intro: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  `,
  loading: css`
    display: grid;
    place-items: center;
    min-height: 240px;
  `,
  metadata: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 24px;

    min-width: 0;
    margin: 0;

    @media (width < 600px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  metadataItem: css`
    display: grid;
    grid-template-columns: minmax(88px, auto) minmax(0, 1fr);
    gap: 12px;
    align-items: center;

    min-width: 0;
    min-height: 48px;
    padding-block: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    & > dt {
      font-size: 13px;
      color: ${cssVar.colorTextSecondary};
    }

    & > dd {
      min-width: 0;
      margin: 0;

      color: ${cssVar.colorText};
      text-align: end;
      overflow-wrap: anywhere;
    }
  `,
  source: css`
    display: inline-flex;

    padding-block: 2px;
    padding-inline: 6px;
    border-radius: ${cssVar.borderRadiusSM};

    background: ${cssVar.colorFillSecondary};
  `,
  title: css`
    margin: 0;

    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    color: ${cssVar.colorText};
    overflow-wrap: anywhere;
  `,
}));

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
  const detail = useSWR<ModuleAppDetailData>(
    appId ? ['moduleApp.getDetail', appId, workspaceId] : null,
    () =>
      moduleAppService.getDetail({
        appIdOrSlug: appId!,
        workspaceId,
      }) as Promise<ModuleAppDetailData>,
  );
  const catalog = useSWR<ModuleAppCatalogItem[]>(
    appId ? ['moduleApp.listCatalog', appId] : null,
    () => moduleAppService.listCatalog({ appId }) as Promise<ModuleAppCatalogItem[]>,
  );
  const license = useSWR<ModuleAppLicenseData | null>(
    appId ? ['moduleApp.getLicense', appId, workspaceId] : null,
    () =>
      moduleAppService.getLicense({
        appId: appId!,
        workspaceId,
      }) as Promise<ModuleAppLicenseData | null>,
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
    () => orders.data?.find((order) => isOrderInScope(order, detail.data?.id, workspaceId)),
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

  if (detail.isLoading)
    return (
      <div aria-label={t('moduleApps.market.loading')} className={styles.loading} role="status">
        <NeuralNetworkLoading size={40} />
      </div>
    );
  if (detail.error || !detail.data) {
    return (
      <MobileStateView
        title={t('moduleApps.market.loadError')}
        variant="error"
        action={{
          label: t('moduleApps.market.retry'),
          onClick: () => void detail.mutate(),
        }}
      />
    );
  }
  const detailData = detail.data;

  const createOrder = async (input: {
    idempotencyKey: string;
    productId: string;
    workspaceId?: string;
  }) => {
    const order = (await moduleAppService.createOrder(input)) as ModuleAppOrderData;
    await orders.mutate();
    return order;
  };
  const createPayment = async (input: { orderId: string; subject: string }) => {
    const payment = (await moduleAppService.createPayment(input)) as ModuleAppPaymentData;
    submitModuleAppPaymentForm(payment.body);
  };
  const install = async ({
    appId: installAppId,
    workspaceId: installWorkspaceId,
  }: {
    appId: string;
    workspaceId?: string;
  }) => {
    setInstallationLoading(true);
    try {
      if (installWorkspaceId) {
        await moduleAppService.installWorkspace({
          appId: installAppId,
          workspaceId: installWorkspaceId,
        });
      } else {
        await moduleAppService.installPersonal({ appId: installAppId });
      }
      await detail.mutate();
    } finally {
      setInstallationLoading(false);
    }
  };
  const uninstall = async () => {
    setInstallationLoading(true);
    try {
      if (workspaceId) {
        await moduleAppService.uninstallWorkspace({ appId: detailData.id, workspaceId });
      } else {
        await moduleAppService.uninstallPersonal({ appId: detailData.id });
      }
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
    <main className={styles.frame} data-testid="module-app-detail">
      <header className={styles.header}>
        <div className={styles.intro}>
          <h1 className={styles.title}>{detailData.displayName}</h1>
          {detailData.description ? (
            <p className={styles.description}>{detailData.description}</p>
          ) : null}
        </div>
        <div className={styles.actions} data-testid="module-app-detail-actions">
          {detailData.installed ? (
            <>
              <Button
                data-button-type="primary"
                href={`/apps/${detailData.id}/app${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`}
                type="primary"
              >
                {t('moduleApps.market.open')}
              </Button>
              <Button danger loading={installationLoading} onClick={uninstall}>
                {t('moduleApps.market.uninstall')}
              </Button>
            </>
          ) : licenseData ? (
            <Button
              data-button-type="primary"
              loading={installationLoading}
              type="primary"
              onClick={() => install({ appId: detailData.id, workspaceId })}
            >
              {t('moduleApps.purchase.install')}
            </Button>
          ) : (
            <Button
              data-button-type="primary"
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
        </div>
      </header>
      <dl className={styles.metadata} data-testid="module-app-detail-metadata">
        <div className={styles.metadataItem} data-testid="module-app-detail-metadata-item">
          <dt>{t('moduleApps.market.category')}</dt>
          <dd>{detailData.category}</dd>
        </div>
        <div className={styles.metadataItem} data-testid="module-app-detail-metadata-item">
          <dt>{t('moduleApps.market.version')}</dt>
          <dd>{detailData.version}</dd>
        </div>
        <div className={styles.metadataItem} data-testid="module-app-detail-metadata-item">
          <dt>{t('moduleApps.market.source')}</dt>
          <dd>
            <span className={styles.source}>{detailData.source ?? 'admin'}</span>
          </dd>
        </div>
        <div className={styles.metadataItem} data-testid="module-app-detail-metadata-item">
          <dt>{t('moduleApps.market.actions')}</dt>
          <dd>{detailData.actions.length}</dd>
        </div>
      </dl>
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
    </main>
  );
});

ModuleAppDetail.displayName = 'ModuleAppDetail';

export default ModuleAppDetail;
