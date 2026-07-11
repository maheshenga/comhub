import { Flexbox, Text } from '@lobehub/ui';
import { Button, Tag } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type ModuleAppCardProps = {
  category?: string;
  description?: string;
  id: string;
  installed?: boolean;
  name: string;
  workspaceId?: string;
};

const ModuleAppCard = memo<ModuleAppCardProps>(
  ({ category, description, id, installed, name, workspaceId }) => {
    const { t } = useTranslation('common');
    const detailUrl = `/apps/${id}${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`;
    return (
      <Flexbox gap={8} padding={16} style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8 }}>
        <Flexbox horizontal align="center" justify="space-between">
          <Text as="h3" style={{ margin: 0 }} weight={600}>{name}</Text>
          {installed && <Tag color="green">{t('moduleApps.market.installed')}</Tag>}
        </Flexbox>
        {category && <Text type="secondary">{category}</Text>}
        {description && <Text type="secondary">{description}</Text>}
        <Button href={detailUrl} type="link">
          {t('moduleApps.market.viewDetails')}
        </Button>
      </Flexbox>
    );
  },
);

ModuleAppCard.displayName = 'ModuleAppCard';

export default ModuleAppCard;
