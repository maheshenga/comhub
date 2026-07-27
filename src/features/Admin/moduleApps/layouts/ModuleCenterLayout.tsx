'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { Drawer } from 'antd';
import { createStaticStyles, useResponsive } from 'antd-style';
import { Menu } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import ModuleSectionNav from '../navigation/ModuleSectionNav';

const styles = createStaticStyles(({ css, cssVar }) => ({
  content: css`
    min-width: 0;
    padding: 20px;
  `,
  layout: css`
    display: grid;
    grid-template-columns: 216px minmax(0, 1fr);
    width: 100%;
    min-height: 100%;

    @media (width < 760px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  navigation: css`
    box-sizing: border-box;
    width: 216px;
    min-height: 100%;
    padding: 12px;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    @media (width < 760px) {
      width: 100%;
      min-height: auto;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      border-inline-end: 0;
    }
  `,
}));

const ModuleCenterLayout = memo(() => {
  const { t } = useTranslation('common');
  const { mobile = false } = useResponsive();
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className={styles.layout}>
      {mobile ? (
        <>
          <Flexbox
            horizontal
            align="center"
            gap={8}
            style={{
              borderBlockEnd: '1px solid var(--lobe-color-border-secondary)',
              minHeight: 44,
              paddingInline: 12,
            }}
          >
            <ActionIcon
              icon={Menu}
              title={t('moduleApps.admin.center.navigation.open')}
              onClick={() => setNavigationOpen(true)}
            />
            <strong>{t('moduleApps.admin.center.navigation.label')}</strong>
          </Flexbox>
          <Drawer
            open={navigationOpen}
            styles={{ body: { padding: 12 } }}
            title={t('moduleApps.admin.center.navigation.label')}
            width={300}
            onClose={() => setNavigationOpen(false)}
          >
            <ModuleSectionNav onNavigate={() => setNavigationOpen(false)} />
          </Drawer>
        </>
      ) : (
        <aside className={styles.navigation}>
          <ModuleSectionNav />
        </aside>
      )}
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
});

ModuleCenterLayout.displayName = 'ModuleCenterLayout';

export default ModuleCenterLayout;
