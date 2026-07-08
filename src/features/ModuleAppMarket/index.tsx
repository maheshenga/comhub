import { memo } from 'react';

type ModuleAppMarketProps = {
  mode?: 'all' | 'my' | 'team';
};

const labels = {
  all: 'Module Apps',
  my: 'My Apps',
  team: 'Team Apps',
};

const ModuleAppMarket = memo<ModuleAppMarketProps>(({ mode = 'all' }) => {
  return <div data-testid={`module-app-market-${mode}`}>{labels[mode]}</div>;
});

ModuleAppMarket.displayName = 'ModuleAppMarket';

export const ModuleAppMyApps = memo(() => <ModuleAppMarket mode="my" />);
ModuleAppMyApps.displayName = 'ModuleAppMyApps';

export const ModuleAppTeamApps = memo(() => <ModuleAppMarket mode="team" />);
ModuleAppTeamApps.displayName = 'ModuleAppTeamApps';

export default ModuleAppMarket;
