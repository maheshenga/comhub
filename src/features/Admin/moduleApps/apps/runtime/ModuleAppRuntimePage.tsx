'use client';

import { createStaticStyles } from 'antd-style';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

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
} from '../../types';

const styles = createStaticStyles(({ css, cssVar }) => ({
  header: css`
    display: flex;
    gap: 12px;
    align-items: baseline;
    justify-content: space-between;
  `,
  page: css`
    display: grid;
    gap: 20px;
    max-width: 1180px;
  `,
  section: css`
    display: grid;
    gap: 10px;
    padding-block: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));

type ListResponse<T> = { items?: T[]; nextCursor?: null | string };

type RuntimeSectionProps<T> = {
  children: ReactNode;
  data?: ListResponse<T>;
  emptyDescription: string;
  emptyTitle: string;
  error?: unknown;
  href: string;
  isLoading?: boolean;
  onRetry: () => void;
  testId: string;
  title: string;
};

const RuntimeSection = <T,>({
  children,
  data,
  emptyDescription,
  emptyTitle,
  error,
  href,
  isLoading,
  onRetry,
  testId,
  title,
}: RuntimeSectionProps<T>) => (
  <section className={styles.section} data-testid={testId}>
    <header className={styles.header}>
      <h2>{title}</h2>
      <Link to={href}>{title}</Link>
    </header>
    <ModulePageState
      emptyDescription={emptyDescription}
      emptyTitle={emptyTitle}
      error={error}
      isEmpty={!isLoading && !error && (data?.items?.length ?? 0) === 0}
      loading={isLoading}
      onRetry={onRetry}
    >
      {children}
    </ModulePageState>
  </section>
);

const ModuleAppRuntimePage = memo(() => {
  const { t: translate } = useTranslation('common');
  const t = (key: string) => translate(key as any);
  const { appId } = useParams<{ appId: string }>();
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

  if (!appId) return <p>{t('moduleApps.admin.operations.selectAppDescription')}</p>;

  const globalPath = (
    routeId: 'module-artifacts' | 'module-installs' | 'module-records' | 'module-runs',
  ) => `${MODULE_ADMIN_ROUTE_PATHS[routeId]}?appId=${encodeURIComponent(appId)}`;

  return (
    <section className={styles.page} data-testid="module-app-runtime">
      <header>
        <h1>{t('moduleApps.admin.runtime.title')}</h1>
        <p>{t('moduleApps.admin.runtime.description')}</p>
      </header>
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
