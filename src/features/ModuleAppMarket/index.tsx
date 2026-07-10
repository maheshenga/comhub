import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import MyAppsOverview from './MyAppsOverview';

type ModuleAppMarketProps = {
  mode?: 'all' | 'my' | 'team';
};

const labelKeys = {
  all: 'moduleApps.market.title',
  my: 'moduleApps.my.title',
  team: 'moduleApps.team.title',
} as const;

const ModuleAppMarket = memo<ModuleAppMarketProps>(({ mode = 'all' }) => {
  const { t } = useTranslation('common');

  return (
    <Flexbox data-testid={`module-app-market-${mode}`} gap={20} padding={24} width={'100%'}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <h2 style={{ fontSize: 20, margin: 0 }}>{t(labelKeys[mode])}</h2>
      </Flexbox>
      {mode === 'my' && <MyAppsOverview />}
    </Flexbox>
  );
});

ModuleAppMarket.displayName = 'ModuleAppMarket';

export const ModuleAppMyApps = memo(() => <ModuleAppMarket mode="my" />);
ModuleAppMyApps.displayName = 'ModuleAppMyApps';

export const ModuleAppTeamApps = memo(() => <ModuleAppMarket mode="team" />);
ModuleAppTeamApps.displayName = 'ModuleAppTeamApps';

export default ModuleAppMarket;
