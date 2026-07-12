import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import useSWR from 'swr';

import { moduleAppService } from '@/services/moduleApp';

import AppCard from './AppCard';
import MyAppsOverview from './MyAppsOverview';

type MarketplaceItem = {
  category?: string;
  displayName: string;
  id: string;
  installed?: boolean;
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
    <Flexbox data-testid={`module-app-market-${mode}`} gap={20} padding={24} width={'100%'}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <h2 style={{ fontSize: 20, margin: 0 }}>{t(labelKeys[mode])}</h2>
      </Flexbox>
      {mode === 'my' ? (
        <MyAppsOverview />
      ) : mode === 'team' && !workspaceId ? (
        <span>{t('moduleApps.market.empty')}</span>
      ) : (
        apps.error ? (
          <span role="alert">{t('moduleApps.market.loadError')}</span>
        ) : apps.isLoading ? (
          <span role="status">{t('moduleApps.market.loading')}</span>
        ) : apps.data?.length ? (
          <Flexbox gap={12}>
            {apps.data.map((app) => (
              <AppCard
                category={app.category}
                id={app.id}
                installed={app.installed}
                key={app.id}
                name={app.displayName}
                workspaceId={mode === 'team' ? workspaceId : undefined}
              />
            ))}
          </Flexbox>
        ) : (
          <span>{t('moduleApps.market.empty')}</span>
        )
      )}
    </Flexbox>
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
