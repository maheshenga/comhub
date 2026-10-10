'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { confirmModal, toast } from '@lobehub/ui/base-ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { ADMIN_SETTINGS_SECTION_SWR_KEY } from '@/const/adminCacheKeys';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import ArtifactsTable from '../../ArtifactsTable';
import InstallsTable from '../../InstallsTable';
import { MODULE_ADMIN_ROUTE_PATHS } from '../../navigation/catalog';
import RecordsTable from '../../RecordsTable';
import RunsTable from '../../RunsTable';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import ModulePageState from '../../shared/ModulePageState';
import type {
  ModuleAppArtifactRow,
  ModuleAppInstallRow,
  ModuleAppRecordRow,
  ModuleAppRunRow,
  ModuleAppRuntimeDiagnostics,
} from '../../types';
import ModuleAppRuntimeSettings from './ModuleAppRuntimeSettings';
import {
  buildGatewayDiagnosticRows,
  buildRuntimeDiagnosticRows,
  buildSchedulerDiagnosticRows,
} from './runtimeDiagnostics';
import { RuntimeDiagnosticsPanel } from './RuntimeDiagnosticsPanel';
import { RuntimeSection } from './RuntimeSection';
import { runtimeStyles as styles } from './runtimeStyles';

type ListResponse<T> = { items?: T[]; nextCursor?: null | string };

const ModuleAppRuntimePage = memo(() => {
  const { t: translate } = useTranslation('common');
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(key as any, options as any);
  const { appId } = useParams<{ appId: string }>();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite);
  const [dispatchingSchedules, setDispatchingSchedules] = useState(false);
  const runtimeSettingsKey = appId ? ADMIN_SETTINGS_SECTION_SWR_KEY('module-runtime') : null;
  const diagnosticsKey = appId ? moduleAppCacheKeys.runtimeDiagnostics() : null;
  const installsKey = appId ? moduleAppCacheKeys.runtime('installs', appId, 10) : null;
  const recordsKey = appId ? moduleAppCacheKeys.runtime('records', appId, 10) : null;
  const runsKey = appId ? moduleAppCacheKeys.runtime('runs', appId, 10) : null;
  const artifactsKey = appId ? moduleAppCacheKeys.runtime('artifacts', appId, 10) : null;
  const installs = useClientDataSWR<ListResponse<ModuleAppInstallRow>>(
    installsKey,
    () =>
      adminCommercialService.moduleApps.listInstalls({
        appId: appId!,
        cursor: undefined,
        limit: 10,
      }) as Promise<ListResponse<ModuleAppInstallRow>>,
  );
  const records = useClientDataSWR<ListResponse<ModuleAppRecordRow>>(
    recordsKey,
    () =>
      adminCommercialService.moduleApps.listRecords({
        appId: appId!,
        cursor: undefined,
        limit: 10,
      }) as Promise<ListResponse<ModuleAppRecordRow>>,
  );
  const runs = useClientDataSWR<ListResponse<ModuleAppRunRow>>(
    runsKey,
    () =>
      adminCommercialService.moduleApps.listRuns({
        appId: appId!,
        cursor: undefined,
        limit: 10,
      }) as Promise<ListResponse<ModuleAppRunRow>>,
  );
  const artifacts = useClientDataSWR<ListResponse<ModuleAppArtifactRow>>(
    artifactsKey,
    () =>
      adminCommercialService.moduleApps.listArtifacts({
        appId: appId!,
        cursor: undefined,
        limit: 10,
      }) as Promise<ListResponse<ModuleAppArtifactRow>>,
  );
  const runtimeSettings = useClientDataSWR(runtimeSettingsKey, () =>
    adminCommercialService.getSettingsSection('module-runtime'),
  );
  const diagnostics = useClientDataSWR<ModuleAppRuntimeDiagnostics>(diagnosticsKey, () =>
    adminCommercialService.moduleApps.getRuntimeDiagnostics(),
  );

  const confirmScheduleDispatch = () => {
    confirmModal({
      content: t('moduleApps.admin.runtime.diagnostics.dispatchNowConfirm'),
      okText: t('moduleApps.admin.runtime.diagnostics.dispatchNow'),
      title: t('moduleApps.admin.runtime.diagnostics.dispatchNow'),
      onOk: async () => {
        setDispatchingSchedules(true);
        try {
          const result = await adminCommercialService.moduleApps.dispatchSchedulesNow();
          const failed = result.failed + result.bookkeepingFailed;
          const message = t(
            failed > 0
              ? 'moduleApps.admin.runtime.diagnostics.dispatchNowPartial'
              : 'moduleApps.admin.runtime.diagnostics.dispatchNowSuccess',
            { claimed: result.claimed, dispatched: result.dispatched, failed },
          );
          if (failed > 0) toast.warning(message);
          else toast.success(message);
          if (diagnosticsKey) await mutate(diagnosticsKey);
        } catch (error) {
          toast.error(
            t(
              error instanceof Error && error.message === 'MODULE_APP_SCHEDULE_DISPATCH_DISABLED'
                ? 'moduleApps.admin.runtime.diagnostics.dispatchNowDisabled'
                : 'moduleApps.admin.runtime.diagnostics.dispatchNowFailed',
            ),
          );
        } finally {
          setDispatchingSchedules(false);
        }
      },
    });
  };

  if (!appId) return <p>{t('moduleApps.admin.operations.selectAppDescription')}</p>;

  const globalPath = (
    routeId: 'module-artifacts' | 'module-installs' | 'module-records' | 'module-runs',
  ) => `${MODULE_ADMIN_ROUTE_PATHS[routeId]}?appId=${encodeURIComponent(appId)}`;

  const diagnosticParams = diagnostics.data ? { diagnostics: diagnostics.data, t } : null;

  return (
    <section className={styles.page} data-testid="module-app-runtime">
      <header>
        <h1>{t('moduleApps.admin.runtime.title')}</h1>
        <p>{t('moduleApps.admin.runtime.description')}</p>
      </header>
      <section className={styles.section} data-testid="module-runtime-control-center">
        <header>
          <h2>{t('moduleApps.admin.runtime.settings.title')}</h2>
          <p>{t('moduleApps.admin.runtime.settings.subtitle')}</p>
        </header>
        <ModulePageState
          emptyDescription={t('moduleApps.admin.runtime.settings.subtitle')}
          emptyTitle={t('moduleApps.admin.runtime.settings.title')}
          error={runtimeSettings.error}
          isEmpty={false}
          loading={runtimeSettings.isLoading}
          onRetry={() => runtimeSettingsKey && void mutate(runtimeSettingsKey)}
        >
          {runtimeSettings.data?.moduleAppRuntimeConfig ? (
            <ModuleAppRuntimeSettings
              canWrite={canWrite}
              settings={runtimeSettings.data.moduleAppRuntimeConfig}
            />
          ) : null}
        </ModulePageState>
      </section>
      <section className={styles.section} data-testid="module-runtime-diagnostics">
        <ModulePageState
          emptyDescription={t('moduleApps.admin.runtime.diagnostics.emptyDescription')}
          emptyTitle={t('moduleApps.admin.runtime.diagnostics.emptyTitle')}
          error={diagnostics.error}
          isEmpty={!diagnostics.isLoading && !diagnostics.error && !diagnostics.data}
          loading={diagnostics.isLoading}
          onRetry={() => diagnosticsKey && void mutate(diagnosticsKey)}
        >
          {diagnostics.data && diagnosticParams ? (
            <RuntimeDiagnosticsPanel
              canWrite={canWrite}
              diagnosticsData={diagnostics.data}
              dispatchingSchedules={dispatchingSchedules}
              gatewayRows={buildGatewayDiagnosticRows(diagnosticParams)}
              runtimeRows={buildRuntimeDiagnosticRows(diagnosticParams)}
              schedulerRows={buildSchedulerDiagnosticRows(diagnosticParams)}
              t={t}
              onRefresh={() => diagnosticsKey && void mutate(diagnosticsKey)}
              onScheduleDispatch={confirmScheduleDispatch}
            />
          ) : null}
        </ModulePageState>
      </section>
      <RuntimeSection
        data={installs.data}
        emptyDescription={t('moduleApps.admin.runtime.emptyDescription')}
        emptyTitle={t('moduleApps.admin.runtime.emptyTitle')}
        error={installs.error}
        href={globalPath('module-installs')}
        isLoading={installs.isLoading}
        testId="module-runtime-installs"
        title={t('moduleApps.admin.runtime.installs')}
        onRetry={() => installsKey && void mutate(installsKey)}
      >
        <InstallsTable
          items={installs.data?.items}
          labels={{
            install: t('moduleApps.admin.operations.installs.columns.install'),
            installed: t('moduleApps.admin.operations.installs.columns.installed'),
            scope: t('moduleApps.admin.operations.installs.columns.scope'),
            status: t('moduleApps.admin.operations.installs.columns.status'),
            user: t('moduleApps.admin.operations.installs.columns.user'),
            workspace: t('moduleApps.admin.operations.installs.columns.workspace'),
          }}
        />
      </RuntimeSection>
      <RuntimeSection
        data={records.data}
        emptyDescription={t('moduleApps.admin.runtime.emptyDescription')}
        emptyTitle={t('moduleApps.admin.runtime.emptyTitle')}
        error={records.error}
        href={globalPath('module-records')}
        isLoading={records.isLoading}
        testId="module-runtime-records"
        title={t('moduleApps.admin.runtime.records')}
        onRetry={() => recordsKey && void mutate(recordsKey)}
      >
        <RecordsTable
          items={records.data?.items}
          labels={{
            collection: t('moduleApps.admin.operations.records.columns.collection'),
            record: t('moduleApps.admin.operations.records.columns.record'),
            scope: t('moduleApps.admin.operations.records.columns.scope'),
            status: t('moduleApps.admin.operations.records.columns.status'),
            updated: t('moduleApps.admin.operations.records.columns.updated'),
          }}
        />
      </RuntimeSection>
      <RuntimeSection
        data={runs.data}
        emptyDescription={t('moduleApps.admin.runtime.emptyDescription')}
        emptyTitle={t('moduleApps.admin.runtime.emptyTitle')}
        error={runs.error}
        href={globalPath('module-runs')}
        isLoading={runs.isLoading}
        testId="module-runtime-runs"
        title={t('moduleApps.admin.runtime.runs')}
        onRetry={() => runsKey && void mutate(runsKey)}
      >
        <RunsTable
          items={runs.data?.items}
          labels={{
            action: t('moduleApps.admin.operations.runs.columns.action'),
            created: t('moduleApps.admin.operations.runs.columns.created'),
            duration: t('moduleApps.admin.operations.runs.columns.duration'),
            error: t('moduleApps.admin.operations.runs.columns.error'),
            run: t('moduleApps.admin.operations.runs.columns.run'),
            status: t('moduleApps.admin.operations.runs.columns.status'),
          }}
        />
      </RuntimeSection>
      <RuntimeSection
        data={artifacts.data}
        emptyDescription={t('moduleApps.admin.runtime.emptyDescription')}
        emptyTitle={t('moduleApps.admin.runtime.emptyTitle')}
        error={artifacts.error}
        href={globalPath('module-artifacts')}
        isLoading={artifacts.isLoading}
        testId="module-runtime-artifacts"
        title={t('moduleApps.admin.runtime.artifacts')}
        onRetry={() => artifactsKey && void mutate(artifactsKey)}
      >
        <ArtifactsTable
          items={artifacts.data?.items}
          labels={{
            artifact: t('moduleApps.admin.operations.artifacts.columns.artifact'),
            file: t('moduleApps.admin.operations.artifacts.columns.file'),
            mime: t('moduleApps.admin.operations.artifacts.columns.mime'),
            scope: t('moduleApps.admin.operations.artifacts.columns.scope'),
            size: t('moduleApps.admin.operations.artifacts.columns.size'),
            storageKey: t('moduleApps.admin.operations.artifacts.columns.storageKey'),
          }}
        />
      </RuntimeSection>
    </section>
  );
});

ModuleAppRuntimePage.displayName = 'ModuleAppRuntimePage';

export default ModuleAppRuntimePage;
