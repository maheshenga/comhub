'use client';

import type {
  ModuleAppPackageSubmissionListResult,
  ModuleAppPackageSubmissionSummary,
} from '@lobechat/types';
import { Flexbox, Skeleton, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { moduleAppService } from '@/services/moduleApp';

import ModuleAppPackageUploader from './PackageUploader';

const styles = createStaticStyles(({ css, cssVar }) => ({
  list: css`
    border-block: 1px solid ${cssVar.colorBorderSecondary};
  `,
  row: css`
    padding-block: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    &:last-child {
      border-block-end: 0;
    }
  `,
  status: css`
    flex: none;

    padding-block: 2px;
    padding-inline: 6px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
  statusApproved: css`
    color: ${cssVar.colorSuccess};
    background: ${cssVar.colorSuccessBg};
  `,
  statusRejected: css`
    color: ${cssVar.colorError};
    background: ${cssVar.colorErrorBg};
  `,
}));

type InstalledModuleApp = {
  category?: string;
  description?: string;
  displayName: string;
  id: string;
  slug?: string;
  version?: null | string;
};

type ModuleAppMyAppsViewProps = {
  apps: InstalledModuleApp[];
  appsError?: unknown;
  loadingApps: boolean;
  loadingSubmissions: boolean;
  onPackageSubmitted: () => Promise<void> | void;
  submissions: ModuleAppPackageSubmissionSummary[];
  submissionsError?: unknown;
};

const statusLabelKeys = {
  approved: 'moduleApps.submissions.status.approved',
  pending_review: 'moduleApps.submissions.status.pendingReview',
  rejected: 'moduleApps.submissions.status.rejected',
} as const;

const statusClassNames = {
  approved: styles.statusApproved,
  pending_review: '',
  rejected: styles.statusRejected,
} as const;

const Loading = () => <Skeleton active paragraph={{ rows: 2 }} title={false} />;

export const ModuleAppMyAppsView = memo<ModuleAppMyAppsViewProps>(
  ({
    apps,
    appsError,
    loadingApps,
    loadingSubmissions,
    onPackageSubmitted,
    submissions,
    submissionsError,
  }) => {
    const { t } = useTranslation('common');

    return (
      <Flexbox gap={28}>
        <Flexbox gap={12}>
          <Text as={'h3'} style={{ fontSize: 16, margin: 0 }} weight={600}>
            {t('moduleApps.installed.title')}
          </Text>
          {loadingApps ? (
            <Loading />
          ) : appsError ? (
            <Text role={'alert'} type={'danger'}>
              {t('moduleApps.installed.loadError')}
            </Text>
          ) : apps.length === 0 ? (
            <Text type={'secondary'}>{t('moduleApps.installed.empty')}</Text>
          ) : (
            <Flexbox className={styles.list}>
              {apps.map((app) => (
                <Flexbox className={styles.row} gap={4} key={app.id}>
                  <Text weight={600}>{app.displayName}</Text>
                  <Text fontSize={12} type={'secondary'}>
                    {[app.category, app.version].filter(Boolean).join(' · ') || app.slug}
                  </Text>
                  {app.description && (
                    <Text fontSize={13} type={'secondary'}>
                      {app.description}
                    </Text>
                  )}
                </Flexbox>
              ))}
            </Flexbox>
          )}
        </Flexbox>

        <Flexbox gap={12}>
          <Flexbox horizontal align={'center'} justify={'space-between'}>
            <Text as={'h3'} style={{ fontSize: 16, margin: 0 }} weight={600}>
              {t('moduleApps.submissions.title')}
            </Text>
            <ModuleAppPackageUploader onSubmitted={onPackageSubmitted} />
          </Flexbox>
          {loadingSubmissions ? (
            <Loading />
          ) : submissionsError ? (
            <Text role={'alert'} type={'danger'}>
              {t('moduleApps.submissions.loadError')}
            </Text>
          ) : submissions.length === 0 ? (
            <Text type={'secondary'}>{t('moduleApps.submissions.empty')}</Text>
          ) : (
            <Flexbox className={styles.list}>
              {submissions.map((submission) => (
                <Flexbox className={styles.row} gap={6} key={submission.id}>
                  <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
                    <Text weight={600}>{submission.appDisplayName}</Text>
                    <span
                      className={[styles.status, statusClassNames[submission.reviewStatus]]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {t(statusLabelKeys[submission.reviewStatus])}
                    </span>
                  </Flexbox>
                  <Text fontSize={12} type={'secondary'}>
                    {submission.fileName} · {submission.packageVersion}
                  </Text>
                  {submission.rejectionReason && (
                    <Text fontSize={12} type={'danger'}>
                      {submission.rejectionReason}
                    </Text>
                  )}
                </Flexbox>
              ))}
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
    );
  },
);
ModuleAppMyAppsView.displayName = 'ModuleAppMyAppsView';

const MyAppsOverview = memo(() => {
  const appsSWR = useSWR<InstalledModuleApp[]>(['moduleApp.listMyApps'], () =>
    moduleAppService.listMyApps() as Promise<InstalledModuleApp[]>,
  );
  const submissionsSWR = useSWR<ModuleAppPackageSubmissionListResult>(
    ['moduleApp.listMyPackageSubmissions'],
    () => moduleAppService.listMyPackageSubmissions({ limit: 20 }),
  );

  return (
    <ModuleAppMyAppsView
      apps={appsSWR.data ?? []}
      appsError={appsSWR.error}
      loadingApps={appsSWR.isLoading}
      loadingSubmissions={submissionsSWR.isLoading}
      submissions={submissionsSWR.data?.items ?? []}
      submissionsError={submissionsSWR.error}
      onPackageSubmitted={async () => {
        await submissionsSWR.mutate();
      }}
    />
  );
});

MyAppsOverview.displayName = 'MyAppsOverview';

export default MyAppsOverview;
