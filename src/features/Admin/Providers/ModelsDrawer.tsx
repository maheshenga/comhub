'use client';

import { Drawer, Tabs } from '@lobehub/ui/base-ui';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getAdminModelTypeLabel } from '../adminModelTypeLabels';
import ModelTypePanel from './ModelTypePanel';
import { type InstanceRow,MODEL_TYPES } from './shared';

const ModelsDrawer = memo<{ instance: InstanceRow | null; onClose: () => void }>(
  ({ instance, onClose }) => {
    const { t } = useTranslation('subscription');
    const [activeTab, setActiveTab] = useState<(typeof MODEL_TYPES)[number]>('chat');

    const tabs = useMemo(
      () =>
        MODEL_TYPES.map((type) => ({
          children: instance ? <ModelTypePanel instanceId={instance.id} modelType={type} /> : null,
          key: type,
          label: t(`admin.providers.modelType.${type}`, getAdminModelTypeLabel(type)),
        })),
      [instance, t],
    );

    return (
      <Drawer
        open={!!instance}
        width={980}
        title={
          instance
            ? t('admin.providers.drawer.title', '{{name}} 的模型', { name: instance.name })
            : ''
        }
        onClose={onClose}
      >
        <Tabs
          activeKey={activeTab}
          items={tabs}
          onChange={(k: string) => setActiveTab(k as (typeof MODEL_TYPES)[number])}
        />
      </Drawer>
    );
  },
);

ModelsDrawer.displayName = 'ModelsDrawer';

export default ModelsDrawer;
