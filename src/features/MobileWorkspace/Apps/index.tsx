'use client';

import { Button, Empty, Flexbox, Icon, Skeleton } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { Boxes, Store } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { moduleAppService } from '@/services/moduleApp';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import { getMobileIcon } from '../mobileIcons';
import MobilePageLayout from '../MobilePageLayout';
import { useMobileConfig } from '../useMobileConfig';
import {
  buildMobileBuiltinApps,
  buildMobileModuleApps,
  type MobileInstalledModuleApp,
} from './builtinApps';

const styles = createStaticStyles(({ css, cssVar }) => ({
  appButton: css`
    display: flex;
    min-width: 0;
    min-height: 92px;
    align-items: center;
    justify-content: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 8px 4px;
    border: 0;
    color: ${cssVar.colorText};
    background: transparent;
    cursor: pointer;

    &:active {
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  appGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding-inline: 8px;
  `,
  appIcon: css`
    display: grid;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    place-items: center;
    border-radius: 8px;
    color: ${cssVar.colorPrimary};
    background: ${cssVar.colorFillSecondary};
  `,
  appLabel: css`
    display: -webkit-box;
    overflow: hidden;
    max-width: 100%;
    min-height: 36px;
    font-size: 13px;
    line-height: 18px;
    text-align: center;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
  headerAction: css`
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    padding: 0;
    border: 0;
    color: ${cssVar.colorText};
    background: transparent;
    cursor: pointer;
  `,
  headerTitle: css`
    margin: 0;
    color: ${cssVar.colorText};
    font-size: 17px;
    font-weight: 600;
  `,
  page: css`
    width: 100%;
    padding-block: 8px 16px;
  `,
  section: css`
    padding-block: 8px;
  `,
  sectionHeading: css`
    margin: 0;
    padding-block: 8px;
    padding-inline: 16px;
    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
    font-weight: 600;
  `,
  state: css`
    min-height: 152px;
    padding: 24px 16px;
    text-align: center;
  `,
}));

const MobileAppsPage = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useWorkspaceAwareNavigate();
  const { config } = useMobileConfig();
  const { data, error, isLoading, mutate } = useSWR<MobileInstalledModuleApp[]>(
    ['mobile-module-apps'],
    () => moduleAppService.listMyApps() as Promise<MobileInstalledModuleApp[]>,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const builtins = useMemo(
    () => buildMobileBuiltinApps(config.applications.builtins),
    [config.applications.builtins],
  );
  const moduleApps = useMemo(
    () => buildMobileModuleApps(data ?? [], config.applications.featuredModuleAppIds),
    [config.applications.featuredModuleAppIds, data],
  );
  const pageTitle =
    config.navigation.items.find((item) => item.id === 'slot-4')?.label || t('mobile.apps.title');
  const openMarket = () => navigate('/apps/market', { escape: true });

  const header = (
    <ChatHeader
      left={<h1 className={styles.headerTitle}>{pageTitle}</h1>}
      style={mobileHeaderSticky}
      right={
        <button
          aria-label={t('mobile.apps.browseMarket')}
          className={styles.headerAction}
          title={t('mobile.apps.browseMarket')}
          type="button"
          onClick={openMarket}
        >
          <Icon icon={Store} size={20} />
        </button>
      }
    />
  );

  return (
    <MobilePageLayout header={header}>
      <main className={styles.page}>
        <section aria-labelledby="mobile-builtin-apps-heading" className={styles.section}>
          <h2 className={styles.sectionHeading} id="mobile-builtin-apps-heading">
            {t('mobile.apps.builtIn')}
          </h2>
          <div className={styles.appGrid}>
            {builtins.map((app) => {
              const AppIcon = getMobileIcon(app.icon);
              return (
                <button
                  aria-label={t('mobile.apps.open', { name: app.label })}
                  className={styles.appButton}
                  key={app.id}
                  type="button"
                  onClick={() => navigate(app.path, { escape: true })}
                >
                  <span className={styles.appIcon}>
                    <Icon icon={AppIcon} size={22} />
                  </span>
                  <span className={styles.appLabel}>{app.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="mobile-module-apps-heading" className={styles.section}>
          <h2 className={styles.sectionHeading} id="mobile-module-apps-heading">
            {t('mobile.apps.module')}
          </h2>
          {isLoading ? (
            <Flexbox className={styles.state} data-testid="mobile-apps-loading" gap={12}>
              <Skeleton.Paragraph active rows={3} />
            </Flexbox>
          ) : error ? (
            <Flexbox align="center" className={styles.state} gap={12} justify="center" role="alert">
              <span>{t('mobile.apps.error')}</span>
              <Button onClick={() => void mutate()}>{t('mobile.apps.retry')}</Button>
            </Flexbox>
          ) : moduleApps.length ? (
            <div className={styles.appGrid}>
              {moduleApps.map((app) => (
                <button
                  aria-label={t('mobile.apps.open', { name: app.displayName })}
                  className={styles.appButton}
                  data-testid="mobile-module-app"
                  key={app.id}
                  type="button"
                  onClick={() => navigate(app.routePath, { escape: true })}
                >
                  <span className={styles.appIcon}>
                    <Icon icon={Boxes} size={22} />
                  </span>
                  <span className={styles.appLabel}>{app.displayName}</span>
                </button>
              ))}
            </div>
          ) : (
            <Flexbox align="center" className={styles.state} gap={12} justify="center">
              <Empty description={t('mobile.apps.empty')} />
              <Button onClick={openMarket}>{t('mobile.apps.browseMarket')}</Button>
            </Flexbox>
          )}
        </section>
      </main>
    </MobilePageLayout>
  );
});

MobileAppsPage.displayName = 'MobileAppsPage';

export default MobileAppsPage;
