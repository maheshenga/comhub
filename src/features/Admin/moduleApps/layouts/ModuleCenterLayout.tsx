'use client';

import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
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

const ModuleCenterLayout = memo(() => (
  <div className={styles.layout}>
    <aside className={styles.navigation}>
      <ModuleSectionNav />
    </aside>
    <main className={styles.content}>
      <Outlet />
    </main>
  </div>
));

ModuleCenterLayout.displayName = 'ModuleCenterLayout';

export default ModuleCenterLayout;
