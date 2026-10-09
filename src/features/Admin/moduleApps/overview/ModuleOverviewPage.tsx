'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Select } from '@lobehub/ui/base-ui';
import { ClipboardCheck, CreditCard, PackageCheck, Play } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { MODULE_ADMIN_ROUTE_PATHS } from '../navigation/catalog';
import type { ModuleAppPaymentDiagnosticRow } from '../PaymentReconciliationTable';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import ModulePageState from '../shared/ModulePageState';
import { setFilter } from '../shared/queryState';
import type { AdminModuleAppItem, AdminModuleAppPackageRow, ModuleAppRunRow } from '../types';
import { ModuleOverviewBand, ModuleOverviewRow } from './moduleOverviewBand';
import {
  moduleOverviewStyles as styles,
  statusTranslationKeys,
} from './moduleOverviewShared';

type ListResponse<T> = { items?: T[]; nextCursor?: null | string };

export interface ModuleOverviewPageProps {
  canReadFinance?: boolean;
  canReadModules?: boolean;
}

const appPath = (appId: string) =>
  MODULE_ADMIN_ROUTE_PATHS['module-app-overview'].replace(':appId', encodeURIComponent(appId));

const paymentPath = `${MODULE_ADMIN_ROUTE_PATHS['module-payments']}?discrepancyStatus=open`;

const ModuleOverviewPage = memo<ModuleOverviewPageProps>(
  ({ canReadFinance: canReadFinanceOverride, canReadModules: canReadModulesOverride }) => {
    const { t: translate } = useTranslation('common');
    const t = (key: string) => translate(key as any);
    const [searchParams, setSearchParams] = useSearchParams();
    const role = useUserStore(
      (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
    );
    const canReadFinance =
      canReadFinanceOverride ?? hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead);
    const canReadModules =
      canReadModulesOverride ?? hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppRead);
    const selectedAppId = searchParams.get('appId') ?? '';

    const appsKey = canReadModules ? moduleAppCacheKeys.apps('overview:updated_desc') : null;
    const packagesKey = canReadModules ? moduleAppCacheKeys.packages('pending_review') : null;
    const paymentsKey = canReadFinance
      ? moduleAppCacheKeys.payments('overview:discrepancyStatus=open')
      : null;
    const runsKey =
      canReadModules && selectedAppId ? moduleAppCacheKeys.runtime('runs', selectedAppId, 5) : null;

    const apps = useClientDataSWR<ListResponse<AdminModuleAppItem>>(
      appsKey,
      () =>
        adminCommercialService.moduleApps.list({ limit: 5, sort: 'updated_desc' }) as Promise<
          ListResponse<AdminModuleAppItem>
        >,
    );
    const packages = useClientDataSWR<ListResponse<AdminModuleAppPackageRow>>(
      packagesKey,
      () =>
        adminCommercialService.moduleApps.listPackages({
          limit: 5,
          reviewStatus: 'pending_review',
        }) as Promise<ListResponse<AdminModuleAppPackageRow>>,
    );
    const payments = useClientDataSWR<ListResponse<ModuleAppPaymentDiagnosticRow>>(
      paymentsKey,
      () =>
        adminCommercialService.moduleApps.listPaymentDiagnostics({
          discrepancyStatus: 'open',
          limit: 5,
        }) as Promise<ListResponse<ModuleAppPaymentDiagnosticRow>>,
    );
    const runs = useClientDataSWR<ListResponse<ModuleAppRunRow>>(
      runsKey,
      () =>
        adminCommercialService.moduleApps.listRuns({ appId: selectedAppId, limit: 5 }) as Promise<
          ListResponse<ModuleAppRunRow>
        >,
    );

    const appItems = apps.data?.items ?? [];
    const appOptions = appItems.map((app) => ({ label: app.displayName, value: app.id }));
    if (selectedAppId && !appOptions.some((option) => option.value === selectedAppId)) {
      appOptions.unshift({ label: selectedAppId, value: selectedAppId });
    }
    const selectApp = (value: string) =>
      setSearchParams((current) => setFilter(current, 'appId', value || undefined));
    const packageItems = packages.data?.items ?? [];
    const paymentItems = payments.data?.items ?? [];
    const runItems = runs.data?.items ?? [];
    const statusLabel = (status: string) =>
      statusTranslationKeys[status] ? t(statusTranslationKeys[status]) : status;

    return (
      <section className={styles.page} data-testid="module-overview-page">
        <header>
          <h1>{t('moduleApps.admin.center.overview.title')}</h1>
          <p>{t('moduleApps.admin.center.overview.description')}</p>
        </header>

        {canReadModules ? (
          <>
            <ModuleOverviewBand
              icon={<PackageCheck aria-hidden size={18} />}
              link={MODULE_ADMIN_ROUTE_PATHS['module-reviews']}
              linkLabel={t('moduleApps.admin.center.overview.viewAll')}
              title={t('moduleApps.admin.center.overview.pendingPackages')}
            >
              <ModulePageState
                emptyTitle={t('moduleApps.admin.center.overview.pendingPackagesEmptyTitle')}
                error={packages.error}
                isEmpty={!packages.isLoading && !packages.error && packageItems.length === 0}
                loading={packages.isLoading}
                loadingLabel={t('moduleApps.admin.center.overview.loading')}
                emptyDescription={t(
                  'moduleApps.admin.center.overview.pendingPackagesEmptyDescription',
                )}
                onRetry={() => packagesKey && mutate(packagesKey)}
              >
                <div className={styles.list}>
                  {packageItems.map((item) => (
                    <ModuleOverviewRow
                      key={item.id}
                      label={
                        item.manifestSnapshot?.app?.displayName ??
                        item.manifestSnapshot?.app?.slug ??
                        item.id
                      }
                      secondary={statusLabel(item.reviewStatus)}
                      to={MODULE_ADMIN_ROUTE_PATHS['module-reviews']}
                    />
                  ))}
                </div>
              </ModulePageState>
            </ModuleOverviewBand>

            <ModuleOverviewBand
              icon={<ClipboardCheck aria-hidden size={18} />}
              link={MODULE_ADMIN_ROUTE_PATHS['module-apps']}
              linkLabel={t('moduleApps.admin.center.overview.viewAll')}
              title={t('moduleApps.admin.center.overview.recentApps')}
            >
              <div className={styles.control}>
                <label htmlFor="module-overview-app">
                  {t('moduleApps.admin.center.overview.appSelector')}
                </label>
                <Select
                  id="module-overview-app"
                  value={selectedAppId}
                  options={[
                    {
                      label: t('moduleApps.admin.center.overview.selectApp'),
                      value: '',
                    },
                    ...appOptions,
                  ]}
                  onChange={(value) => selectApp(String(value ?? ''))}
                />
              </div>
              <ModulePageState
                emptyDescription={t('moduleApps.admin.center.overview.recentAppsEmptyDescription')}
                emptyTitle={t('moduleApps.admin.center.overview.recentAppsEmptyTitle')}
                error={apps.error}
                isEmpty={!apps.isLoading && !apps.error && appItems.length === 0}
                loading={apps.isLoading}
                loadingLabel={t('moduleApps.admin.center.overview.loading')}
                onRetry={() => appsKey && mutate(appsKey)}
              >
                <div className={styles.list}>
                  {appItems.map((app) => (
                    <ModuleOverviewRow
                      key={app.id}
                      label={app.displayName}
                      secondary={statusLabel(app.status)}
                      to={appPath(app.id)}
                    />
                  ))}
                </div>
              </ModulePageState>
            </ModuleOverviewBand>

            {selectedAppId ? (
              <ModuleOverviewBand
                icon={<Play aria-hidden size={18} />}
                link={`${MODULE_ADMIN_ROUTE_PATHS['module-runs']}?appId=${encodeURIComponent(selectedAppId)}`}
                linkLabel={t('moduleApps.admin.center.overview.viewAll')}
                title={t('moduleApps.admin.center.overview.recentRuns')}
              >
                <ModulePageState
                  emptyTitle={t('moduleApps.admin.center.overview.recentRunsEmptyTitle')}
                  error={runs.error}
                  isEmpty={!runs.isLoading && !runs.error && runItems.length === 0}
                  loading={runs.isLoading}
                  loadingLabel={t('moduleApps.admin.center.overview.loading')}
                  emptyDescription={t(
                    'moduleApps.admin.center.overview.recentRunsEmptyDescription',
                  )}
                  onRetry={() => runsKey && mutate(runsKey)}
                >
                  <div className={styles.list}>
                    {runItems.map((run) => (
                      <ModuleOverviewRow
                        key={run.id}
                        label={run.id}
                        secondary={statusLabel(run.status)}
                        to={`${MODULE_ADMIN_ROUTE_PATHS['module-runs']}?appId=${encodeURIComponent(selectedAppId)}`}
                      />
                    ))}
                  </div>
                </ModulePageState>
              </ModuleOverviewBand>
            ) : null}
          </>
        ) : null}

        {canReadFinance ? (
          <ModuleOverviewBand
            icon={<CreditCard aria-hidden size={18} />}
            link={paymentPath}
            linkLabel={t('moduleApps.admin.center.overview.viewAll')}
            title={t('moduleApps.admin.center.overview.openDiscrepancies')}
          >
            <ModulePageState
              emptyTitle={t('moduleApps.admin.center.overview.openDiscrepanciesEmptyTitle')}
              error={payments.error}
              isEmpty={!payments.isLoading && !payments.error && paymentItems.length === 0}
              loading={payments.isLoading}
              loadingLabel={t('moduleApps.admin.center.overview.loading')}
              emptyDescription={t(
                'moduleApps.admin.center.overview.openDiscrepanciesEmptyDescription',
              )}
              onRetry={() => paymentsKey && mutate(paymentsKey)}
            >
              <div className={styles.list}>
                {paymentItems.map((payment) => (
                  <ModuleOverviewRow
                    key={payment.id}
                    label={`${payment.appName} / ${payment.orderId}`}
                    secondary={`${payment.totalAmount} ${payment.currency}`}
                    to={paymentPath}
                  />
                ))}
              </div>
            </ModulePageState>
          </ModuleOverviewBand>
        ) : null}
      </section>
    );
  },
);

ModuleOverviewPage.displayName = 'ModuleOverviewPage';

export default ModuleOverviewPage;
