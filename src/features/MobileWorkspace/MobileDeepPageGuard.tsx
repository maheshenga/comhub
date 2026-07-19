'use client';

import { Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ChevronLeft } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';

import { useActiveWorkspaceSlug } from '@/business/client/hooks/useActiveWorkspaceSlug';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

const styles = createStaticStyles(({ css, cssVar }) => ({
  back: css`
    cursor: pointer;

    display: grid;
    place-items: center;

    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;

    color: ${cssVar.colorText};

    background: transparent;
  `,
  content: css`
    overflow: auto;
    flex: 1;
    min-height: 0;
  `,
  header: css`
    position: relative;
    z-index: 2;

    flex: 0 0 44px;

    height: 44px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  root: css`
    display: flex;
    flex-direction: column;

    width: 100%;
    height: 100%;
    min-height: 0;
  `,
}));

const MobileDeepPageGuard = memo(() => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const activeWorkspaceSlug = useActiveWorkspaceSlug();
  const navigate = useWorkspaceAwareNavigate();
  const workspacePrefix = activeWorkspaceSlug ? `/${activeWorkspaceSlug}` : undefined;
  const isWorkspaceRoute = Boolean(
    workspacePrefix &&
      (location.pathname === workspacePrefix || location.pathname.startsWith(`${workspacePrefix}/`)),
  );
  const scopedPath = isWorkspaceRoute ? location.pathname.slice(workspacePrefix!.length) || '/' : location.pathname;
  const fallbackPath = scopedPath.startsWith('/apps') ? '/apps' : '/design';
  const goBack = () => {
    if (location.key === 'default') {
      isWorkspaceRoute ? navigate(fallbackPath) : navigate(fallbackPath, { escape: true });
      return;
    }
    navigate(-1);
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button
          aria-label={t('back')}
          className={styles.back}
          title={t('back')}
          type="button"
          onClick={goBack}
        >
          <Icon icon={ChevronLeft} size={22} />
        </button>
      </header>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
});

MobileDeepPageGuard.displayName = 'MobileDeepPageGuard';

export default MobileDeepPageGuard;
