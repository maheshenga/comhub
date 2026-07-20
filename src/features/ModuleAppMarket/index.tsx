import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import useSWR from 'swr';

import { MobileListSkeleton, MobileStateView } from '@/features/MobileWorkspace/components';
import { moduleAppService } from '@/services/moduleApp';

import AppCard from './AppCard';
import MyAppsOverview from './MyAppsOverview';

type MarketplaceItem = {
  category?: string;
  description?: string;
  displayName: string;
  id: string;
  installed?: boolean;
  version?: string;
};

type ModuleAppMarketProps = {
  mode?: 'all' | 'my' | 'team';
  workspaceId?: string;
};

const labelKeys = {
  all: 'moduleApps.market.title',
  my: 'moduleApps.my.title',
  team: 'moduleApps.team.title',
} as const;

const styles = createStaticStyles(({ css }) => ({
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
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 12px 16px;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
  `,
  heading: css`
    margin: 0;
    font-size: 20px;
    line-height: 28px;
  `,
}));

const ModuleAppMarket = memo<ModuleAppMarketProps>(({ mode = 'all', workspaceId }) => {
  const { t } = useTranslation('common');
  const apps = useSWR<MarketplaceItem[]>(
    mode === 'all'
      ? ['moduleApp.listMarketplace']
      : mode === 'team' && workspaceId
        ? ['moduleApp.listTeamApps', workspaceId]
        : null,
    () =>
      (mode === 'team'
        ? moduleAppService.listTeamApps({ workspaceId: workspaceId! })
        : moduleAppService.listMarketplace()) as Promise<MarketplaceItem[]>,
  );

  return (
    <section className={styles.frame} data-testid={`module-app-market-${mode}`}>
      <header className={styles.header}>
        <h2 className={styles.heading}>{t(labelKeys[mode])}</h2>
      </header>
      {mode === 'my' ? (
        <MyAppsOverview />
      ) : mode === 'team' && !workspaceId ? (
        <MobileStateView
          description={t('moduleApps.market.emptyDescription')}
          title={t('moduleApps.market.empty')}
        />
      ) : apps.error ? (
        <MobileStateView
          title={t('moduleApps.market.loadError')}
          variant="error"
          action={{
            label: t('moduleApps.market.retry'),
            onClick: () => void apps.mutate(),
          }}
        />
      ) : apps.isLoading ? (
        <MobileListSkeleton
          avatarSize={48}
          label={t('moduleApps.market.loading')}
          minRowHeight={88}
          rows={4}
          trailingWidth={72}
        />
      ) : apps.data?.length ? (
        <div className={styles.grid} data-testid="module-app-market-grid">
          {apps.data.map((app) => (
            <AppCard
              category={app.category}
              description={app.description}
              id={app.id}
              installed={app.installed}
              key={app.id}
              name={app.displayName}
              version={app.version}
              workspaceId={mode === 'team' ? workspaceId : undefined}
            />
          ))}
        </div>
      ) : (
        <MobileStateView
          description={t('moduleApps.market.emptyDescription')}
          title={t('moduleApps.market.empty')}
        />
      )}
    </section>
  );
});

ModuleAppMarket.displayName = 'ModuleAppMarket';

export const ModuleAppMyApps = memo(() => <ModuleAppMarket mode="my" />);
ModuleAppMyApps.displayName = 'ModuleAppMyApps';

export const ModuleAppTeamApps = memo(() => {
  const [searchParams] = useSearchParams();
  return (
    <ModuleAppMarket
      mode="team"
      workspaceId={searchParams.get('workspaceId') || undefined}
    />
  );
});
ModuleAppTeamApps.displayName = 'ModuleAppTeamApps';

export default ModuleAppMarket;
