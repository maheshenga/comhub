'use client';

import type {
  ModuleAppDeveloperAppSummary,
  ModuleAppDeveloperFinance,
  ModuleAppDeveloperPackageSummary,
  ModuleAppDeveloperPublisherProfile,
  ModuleAppDeveloperVersionSummary,
} from '@lobechat/types';
import { Icon, Skeleton, Text } from '@lobehub/ui';
import { Button, confirmModal, Input, Tabs, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { EyeOff, RefreshCw, Rocket, RotateCcw } from 'lucide-react';
import { type FormEvent, memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import ModuleAppPackageUploader from '@/features/ModuleAppMarket/PackageUploader';
import { moduleAppService } from '@/services/moduleApp';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
  appHeader: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;

    @media (width < 640px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  empty: css`
    padding-block: 40px;
    color: ${cssVar.colorTextSecondary};
    text-align: center;
  `,
  error: css`
    color: ${cssVar.colorError};
  `,
  field: css`
    display: grid;
    gap: 6px;
    max-width: 480px;
  `,
  frame: css`
    display: flex;
    flex-direction: column;
    gap: 20px;

    box-sizing: border-box;
    width: 100%;
    max-width: 1200px;
    margin-inline: auto;
    padding: 16px;

    @media (width >= 768px) {
      padding: 24px;
    }
  `,
  heading: css`
    margin: 0;
    font-size: 20px;
    line-height: 28px;
  `,
  label: css`
    font-size: 13px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-block: 1px solid ${cssVar.colorBorderSecondary};

    @media (width < 720px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  metric: css`
    min-width: 0;
    padding-block: 14px;
    padding-inline: 16px;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    &:last-child {
      border-inline-end: 0;
    }

    @media (width < 720px) {
      &:nth-child(2) {
        border-inline-end: 0;
      }

      &:nth-child(-n + 2) {
        border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      }
    }
  `,
  metricValue: css`
    font-size: 22px;
    font-weight: 600;
    line-height: 30px;
  `,
  muted: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  notice: css`
    padding-block: 12px;
    padding-inline: 14px;
    border-inline-start: 3px solid ${cssVar.colorWarning};

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorWarningBg};
  `,
  row: css`
    display: grid;
    gap: 10px;
    padding-block: 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    &:last-child {
      border-block-end: 0;
    }
  `,
  section: css`
    display: grid;
    gap: 14px;
  `,
  sectionHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  `,
  status: css`
    display: inline-flex;
    align-items: center;
    align-self: start;

    width: fit-content;
    padding-block: 2px;
    padding-inline: 7px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
  statusGood: css`
    color: ${cssVar.colorSuccess};
    background: ${cssVar.colorSuccessBg};
  `,
  statusBad: css`
    color: ${cssVar.colorError};
    background: ${cssVar.colorErrorBg};
  `,
  subgrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px 16px;

    @media (width < 720px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  title: css`
    margin: 0;
    font-size: 15px;
    line-height: 22px;
    overflow-wrap: anywhere;
  `,
  versionList: css`
    margin-block-start: 2px;
    padding-inline-start: 14px;
    border-inline-start: 2px solid ${cssVar.colorBorderSecondary};
  `,
}));

const statusClass = (status: string) =>
  [
    styles.status,
    [
      'approved',
      'clean',
      'paid',
      'published',
      'ready',
      'settled',
      'succeeded',
      'verified',
    ].includes(status)
      ? styles.statusGood
      : ['blocked', 'failed', 'rejected', 'reversed', 'suspended'].includes(status)
        ? styles.statusBad
        : '',
  ]
    .filter(Boolean)
    .join(' ');

const Status = ({ value }: { value: string }) => (
  <span className={statusClass(value)}>{value}</span>
);

const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <div className={styles.metric}>
    <div className={styles.metricValue}>{value}</div>
    <div className={styles.muted}>{label}</div>
  </div>
);

const PublisherProfile = memo<{
  onSaved: () => Promise<unknown>;
  profile: ModuleAppDeveloperPublisherProfile | null;
}>(({ onSaved, profile }) => {
  const { t } = useTranslation('common');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const suspended = profile?.status === 'suspended';

  useEffect(() => setDisplayName(profile?.displayName ?? ''), [profile?.displayName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await moduleAppService.upsertMyPublisherProfile({ displayName: displayName.trim() });
      await onSaved();
      toast.success(t('moduleApps.developer.profileSaved'));
    } catch {
      toast.error(t('moduleApps.developer.profileError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.section} onSubmit={submit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="module-app-publisher-name">
          {t('moduleApps.developer.publisherName')}
        </label>
        <Input
          disabled={suspended}
          id="module-app-publisher-name"
          maxLength={200}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div className={styles.actionRow}>
        <Button
          disabled={suspended || !displayName.trim()}
          htmlType="submit"
          loading={saving}
          type="primary"
        >
          {t(profile ? 'moduleApps.developer.saveProfile' : 'moduleApps.developer.apply')}
        </Button>
        {profile ? <Status value={profile.status} /> : null}
      </div>
    </form>
  );
});
PublisherProfile.displayName = 'PublisherProfile';

const VersionList = memo<{
  app: ModuleAppDeveloperAppSummary;
  canManage: boolean;
  onChanged: () => Promise<unknown>;
}>(({ app, canManage, onChanged }) => {
  const { t } = useTranslation('common');
  const versions = useSWR<ModuleAppDeveloperVersionSummary[]>(
    ['moduleApp.listMyDeveloperVersions', app.id],
    () => moduleAppService.listMyDeveloperVersions({ appId: app.id }),
  );
  const [rollingBack, setRollingBack] = useState<string>();

  const performRollback = async (version: ModuleAppDeveloperVersionSummary) => {
    setRollingBack(version.id);
    try {
      await moduleAppService.rollbackMyDeveloperApp({ appId: app.id, versionId: version.id });
      await Promise.all([versions.mutate(), onChanged()]);
      toast.success(t('moduleApps.developer.rollbackSuccess'));
    } catch {
      toast.error(t('moduleApps.developer.actionError'));
    } finally {
      setRollingBack(undefined);
    }
  };
  const rollback = (version: ModuleAppDeveloperVersionSummary) => {
    confirmModal({
      content: t('moduleApps.developer.rollbackConfirm', { version: version.version }),
      okText: t('moduleApps.developer.rollback'),
      onOk: () => performRollback(version),
      title: t('moduleApps.developer.rollbackTitle'),
    });
  };

  if (versions.isLoading) return <Skeleton active paragraph={{ rows: 2 }} title={false} />;
  if (versions.error)
    return <div className={styles.error}>{t('moduleApps.developer.loadError')}</div>;

  return (
    <div className={styles.versionList}>
      {(versions.data ?? []).map((version) => (
        <div className={styles.row} key={version.id}>
          <div className={styles.sectionHeader}>
            <div className={styles.actionRow}>
              <strong>{version.version}</strong>
              {version.current ? <Status value={t('moduleApps.developer.current')} /> : null}
              {version.build ? <Status value={version.build.status} /> : null}
            </div>
            {canManage && !version.current && version.publishedAt ? (
              <Button
                icon={<Icon icon={RotateCcw} size={16} />}
                loading={rollingBack === version.id}
                onClick={() => rollback(version)}
              >
                {t('moduleApps.developer.rollback')}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
});
VersionList.displayName = 'VersionList';

const DeveloperAppRow = memo<{
  app: ModuleAppDeveloperAppSummary;
  canManage: boolean;
  onChanged: () => Promise<unknown>;
}>(({ app, canManage, onChanged }) => {
  const { t } = useTranslation('common');
  const [showVersions, setShowVersions] = useState(false);
  const [working, setWorking] = useState(false);
  const canPublish =
    app.latestPackage?.reviewStatus === 'approved' &&
    (!app.latestPackage.build || app.latestPackage.build.status === 'ready');

  const performPublicationChange = async () => {
    setWorking(true);
    try {
      if (app.status === 'published') {
        await moduleAppService.unpublishMyDeveloperApp({ appId: app.id });
      } else {
        await moduleAppService.publishMyDeveloperApp({ appId: app.id });
      }
      await onChanged();
      toast.success(t('moduleApps.developer.actionSuccess'));
    } catch {
      toast.error(t('moduleApps.developer.actionError'));
    } finally {
      setWorking(false);
    }
  };
  const togglePublication = () => {
    if (app.status !== 'published') {
      void performPublicationChange();
      return;
    }
    confirmModal({
      content: t('moduleApps.developer.unpublishConfirm'),
      okText: t('moduleApps.developer.unpublish'),
      onOk: performPublicationChange,
      title: t('moduleApps.developer.unpublishTitle'),
    });
  };

  return (
    <article className={styles.row}>
      <div className={styles.appHeader}>
        <div>
          <h3 className={styles.title}>{app.displayName}</h3>
          <div className={styles.muted}>{app.slug}</div>
        </div>
        <div className={styles.actionRow}>
          <Status value={app.status} />
          <Button
            disabled={!canManage || (app.status !== 'published' && !canPublish)}
            icon={<Icon icon={app.status === 'published' ? EyeOff : Rocket} size={16} />}
            loading={working}
            onClick={togglePublication}
          >
            {t(
              app.status === 'published'
                ? 'moduleApps.developer.unpublish'
                : 'moduleApps.developer.publish',
            )}
          </Button>
          <Button
            icon={<Icon icon={RefreshCw} size={16} />}
            onClick={() => setShowVersions((value) => !value)}
          >
            {t('moduleApps.developer.versions')}
          </Button>
        </div>
      </div>
      <div className={styles.subgrid}>
        <div>
          <div className={styles.muted}>{t('moduleApps.developer.latestVersion')}</div>
          <div>{app.latestVersion?.version ?? '-'}</div>
        </div>
        <div>
          <div className={styles.muted}>{t('moduleApps.developer.build')}</div>
          <div>{app.latestPackage?.build?.status ?? '-'}</div>
        </div>
        <div>
          <div className={styles.muted}>{t('moduleApps.developer.installations')}</div>
          <div>{app.metrics.activeInstallations}</div>
        </div>
        <div>
          <div className={styles.muted}>{t('moduleApps.developer.runs30d')}</div>
          <div>{app.metrics.totalRuns30d}</div>
        </div>
      </div>
      {showVersions ? <VersionList app={app} canManage={canManage} onChanged={onChanged} /> : null}
    </article>
  );
});
DeveloperAppRow.displayName = 'DeveloperAppRow';

const Applications = memo<{
  apps: ModuleAppDeveloperAppSummary[];
  canManage: boolean;
  onChanged: () => Promise<unknown>;
}>(({ apps, canManage, onChanged }) => {
  const { t } = useTranslation('common');
  const totals = useMemo(
    () =>
      apps.reduce(
        (value, app) => ({
          failed: value.failed + app.metrics.failedRuns30d,
          installs: value.installs + app.metrics.activeInstallations,
          runs: value.runs + app.metrics.totalRuns30d,
        }),
        { failed: 0, installs: 0, runs: 0 },
      ),
    [apps],
  );

  return (
    <div className={styles.section}>
      <div className={styles.metricGrid}>
        <Metric label={t('moduleApps.developer.apps')} value={apps.length} />
        <Metric label={t('moduleApps.developer.installations')} value={totals.installs} />
        <Metric label={t('moduleApps.developer.runs30d')} value={totals.runs} />
        <Metric label={t('moduleApps.developer.failedRuns30d')} value={totals.failed} />
      </div>
      {apps.length ? (
        <div>
          {apps.map((app) => (
            <DeveloperAppRow app={app} canManage={canManage} key={app.id} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{t('moduleApps.developer.noApps')}</div>
      )}
    </div>
  );
});
Applications.displayName = 'Applications';

const PackageRow = ({ item }: { item: ModuleAppDeveloperPackageSummary }) => (
  <div className={styles.row}>
    <div className={styles.sectionHeader}>
      <div>
        <strong>{item.appDisplayName}</strong>
        <div className={styles.muted}>
          {item.appSlug} · {item.packageVersion}
        </div>
      </div>
      <div className={styles.actionRow}>
        <Status value={item.reviewStatus} />
        <Status value={item.scanStatus} />
        {item.build ? <Status value={item.build.status} /> : null}
      </div>
    </div>
    {item.rejectionReason ? <div className={styles.error}>{item.rejectionReason}</div> : null}
    {item.build?.failureCode ? <div className={styles.error}>{item.build.failureCode}</div> : null}
    {item.validationReport.map((issue, index) => (
      <div
        className={issue.severity === 'error' ? styles.error : styles.muted}
        key={`${issue.code}-${index}`}
      >
        {issue.code}: {issue.message}
      </div>
    ))}
  </div>
);

const Submissions = memo<{
  items: ModuleAppDeveloperPackageSummary[];
  onSubmitted: () => Promise<void>;
  publisherVerified: boolean;
}>(({ items, onSubmitted, publisherVerified }) => {
  const { t } = useTranslation('common');
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.title}>{t('moduleApps.developer.packages')}</h3>
        {publisherVerified ? <ModuleAppPackageUploader onSubmitted={onSubmitted} /> : null}
      </div>
      {items.length ? (
        items.map((item) => <PackageRow item={item} key={item.id} />)
      ) : (
        <div className={styles.empty}>{t('moduleApps.developer.noPackages')}</div>
      )}
    </div>
  );
});
Submissions.displayName = 'Submissions';

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { currency, style: 'currency' }).format(amount);

const Finance = memo<{ data: ModuleAppDeveloperFinance }>(({ data }) => {
  const { t } = useTranslation('common');
  return (
    <div className={styles.section}>
      {data.summary.map((summary) => (
        <div className={styles.metricGrid} key={summary.currency}>
          <Metric
            label={t('moduleApps.developer.totalRevenue')}
            value={formatMoney(summary.totalAmount, summary.currency)}
          />
          <Metric
            label={t('moduleApps.developer.pendingRevenue')}
            value={formatMoney(summary.pendingAmount, summary.currency)}
          />
          <Metric
            label={t('moduleApps.developer.settledRevenue')}
            value={formatMoney(summary.settledAmount, summary.currency)}
          />
          <Metric
            label={t('moduleApps.developer.payouts')}
            value={data.payouts.filter((payout) => payout.currency === summary.currency).length}
          />
        </div>
      ))}
      {!data.summary.length ? (
        <div className={styles.empty}>{t('moduleApps.developer.noRevenue')}</div>
      ) : null}
      {data.revenue.map((entry) => (
        <div className={styles.row} key={entry.id}>
          <div className={styles.sectionHeader}>
            <span>{formatMoney(entry.developerAmount, entry.currency)}</span>
            <Status value={entry.status} />
          </div>
          <div className={styles.muted}>{entry.type}</div>
        </div>
      ))}
      {data.payouts.map((payout) => (
        <div className={styles.row} key={payout.id}>
          <div className={styles.sectionHeader}>
            <span>{formatMoney(payout.totalAmount, payout.currency)}</span>
            <Status value={payout.status} />
          </div>
          <div className={styles.muted}>{payout.recipientMask ?? '-'}</div>
        </div>
      ))}
    </div>
  );
});
Finance.displayName = 'Finance';

const ModuleAppDeveloper = memo(() => {
  const { t } = useTranslation('common');
  const profile = useSWR(['moduleApp.getMyPublisherProfile'], () =>
    moduleAppService.getMyPublisherProfile(),
  );
  const apps = useSWR(['moduleApp.listMyDeveloperApps'], () =>
    moduleAppService.listMyDeveloperApps({ limit: 50 }),
  );
  const submissions = useSWR(['moduleApp.listMyDeveloperSubmissions'], () =>
    moduleAppService.listMyDeveloperSubmissions({ limit: 50 }),
  );
  const finance = useSWR(['moduleApp.getMyDeveloperFinance'], () =>
    moduleAppService.getMyDeveloperFinance(),
  );

  const loading = profile.isLoading || apps.isLoading || submissions.isLoading || finance.isLoading;
  const error = profile.error || apps.error || submissions.error || finance.error;
  const profileData = profile.data ?? null;

  if (loading) {
    return (
      <section className={styles.frame}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </section>
    );
  }
  if (error) {
    return (
      <section className={styles.frame}>
        <Text type="danger">{t('moduleApps.developer.loadError')}</Text>
        <Button
          onClick={() =>
            void Promise.all([
              profile.mutate(),
              apps.mutate(),
              submissions.mutate(),
              finance.mutate(),
            ])
          }
        >
          {t('moduleApps.developer.retry')}
        </Button>
      </section>
    );
  }

  return (
    <section className={styles.frame} data-testid="module-app-developer-console">
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.heading}>{t('moduleApps.developer.title')}</h2>
          {profileData ? <div className={styles.muted}>{profileData.displayName}</div> : null}
        </div>
        {profileData ? <Status value={profileData.status} /> : null}
      </header>
      {!profileData ? (
        <PublisherProfile profile={null} onSaved={profile.mutate} />
      ) : (
        <>
          {profileData.status !== 'verified' ? (
            <div className={styles.notice} role="status">
              {t(
                profileData.status === 'suspended'
                  ? 'moduleApps.developer.suspended'
                  : 'moduleApps.developer.pending',
              )}
            </div>
          ) : null}
          <Tabs
            items={[
              {
                children: (
                  <Applications
                    apps={apps.data?.items ?? []}
                    canManage={profileData.status === 'verified'}
                    onChanged={apps.mutate}
                  />
                ),
                key: 'apps',
                label: t('moduleApps.developer.apps'),
              },
              {
                children: (
                  <Submissions
                    items={submissions.data?.items ?? []}
                    publisherVerified={profileData.status === 'verified'}
                    onSubmitted={async () => {
                      await Promise.all([submissions.mutate(), apps.mutate()]);
                    }}
                  />
                ),
                key: 'packages',
                label: t('moduleApps.developer.packages'),
              },
              {
                children: (
                  <Finance data={finance.data ?? { payouts: [], revenue: [], summary: [] }} />
                ),
                key: 'finance',
                label: t('moduleApps.developer.finance'),
              },
              {
                children: <PublisherProfile profile={profileData} onSaved={profile.mutate} />,
                key: 'profile',
                label: t('moduleApps.developer.profile'),
              },
            ]}
          />
        </>
      )}
    </section>
  );
});

ModuleAppDeveloper.displayName = 'ModuleAppDeveloper';

export default ModuleAppDeveloper;
