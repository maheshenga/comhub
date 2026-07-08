import { memo } from 'react';

type ModuleAppCardProps = {
  name: string;
};

const ModuleAppCard = memo<ModuleAppCardProps>(({ name }) => {
  return <div>{name}</div>;
});

ModuleAppCard.displayName = 'ModuleAppCard';

export default ModuleAppCard;
