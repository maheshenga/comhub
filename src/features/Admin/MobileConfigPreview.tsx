'use client';

import { Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Boxes } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { type MobilePublicConfigV1, normalizeMobileConfig } from '@/const/mobileConfig';
import { getMobileIcon } from '@/features/MobileWorkspace/mobileIcons';

const styles = createStaticStyles(({ css }) => ({
  app: css`
    display: grid;
    gap: 4px;
    place-items: center;

    min-width: 0;

    font-size: 10px;
    text-align: center;
  `,
  appIcon: css`
    display: grid;
    place-items: center;

    width: 32px;
    height: 32px;
    border-radius: 8px;

    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorFillSecondary};
  `,
  assistant: css`
    display: flex;
    gap: 8px;
    align-items: center;

    min-height: 42px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  assistantAvatar: css`
    display: grid;
    flex: 0 0 30px;
    place-items: center;

    width: 30px;
    height: 30px;
    border-radius: 8px;

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillSecondary};
  `,
  assistantMeta: css`
    overflow: hidden;

    font-size: 9px;
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  assistantName: css`
    overflow: hidden;

    font-size: 11px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  assistantText: css`
    min-width: 0;
  `,
  brand: css`
    overflow: hidden;

    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  brandLogo: css`
    width: 28px;
    height: 28px;
    border-radius: 6px;
    object-fit: contain;
  `,
  content: css`
    overflow: hidden;
    flex: 1;
    padding: 12px;
    background: ${cssVar.colorBgLayout};
  `,
  frame: css`
    overflow: hidden;
    display: flex;
    flex-direction: column;

    width: 100%;
    min-width: 280px;
    max-width: 360px;
    min-height: 560px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px 4px;
  `,
  header: css`
    display: flex;
    flex: 0 0 52px;
    gap: 8px;
    align-items: center;

    height: 52px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  label: css`
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  nav: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    flex: 0 0 54px;

    min-height: 54px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  navItem: css`
    display: grid;
    gap: 1px;
    place-items: center;

    min-width: 0;
    padding-block: 5px;
    padding-inline: 2px;

    font-size: 9px;
    color: ${cssVar.colorTextSecondary};
  `,
  navItemActive: css`
    color: ${cssVar.colorPrimary};
  `,
  section: css`
    margin-block-end: 12px;
  `,
  sectionTitle: css`
    margin-block: 0 6px;
    margin-inline: 0;

    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
  `,
}));

type MobileConfigPreviewProps = {
  config: MobilePublicConfigV1;
};

const MobileConfigPreview = memo<MobileConfigPreviewProps>(({ config }) => {
  const { t } = useTranslation('subscription');
  const normalized = normalizeMobileConfig(config);
  const visibleTabs = normalized.navigation.items
    .filter((item) => item.visible)
    .sort((left, right) => left.order - right.order);
  const enabledTools = normalized.design.tools
    .filter((tool) => tool.enabled)
    .sort((left, right) => left.order - right.order);
  const enabledBuiltins = normalized.applications.builtins
    .filter((app) => app.enabled)
    .sort((left, right) => left.order - right.order);
  const brandName = normalized.brand.displayName || 'ComHub';
  const previewApps = [
    ...enabledBuiltins.map((app) => ({
      icon: getMobileIcon(app.icon),
      id: app.id,
      label: app.label,
    })),
    ...normalized.applications.featuredModuleAppIds.map((id) => ({ icon: Boxes, id, label: id })),
  ].slice(0, 8);

  return (
    <div className={styles.frame} data-testid="mobile-config-preview">
      <header className={styles.header}>
        {normalized.brand.logoUrl ? (
          <img alt={brandName} className={styles.brandLogo} src={normalized.brand.logoUrl} />
        ) : null}
        <span className={styles.brand}>{brandName}</span>
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {normalized.discover.title ||
              t('admin.mobile.featuredAssistants', { defaultValue: 'Featured Assistants' })}
          </h3>
          {normalized.discover.assistants.slice(0, 2).map((assistant) => {
            const title = assistant.titleOverride || assistant.assistantId;
            return (
              <div className={styles.assistant} key={assistant.assistantId}>
                <span className={styles.assistantAvatar}>{title.slice(0, 1).toUpperCase()}</span>
                <span className={styles.assistantText}>
                  <span className={styles.assistantName}>{title}</span>
                  <span className={styles.assistantMeta}>
                    {assistant.provider}/{assistant.model}
                  </span>
                </span>
              </div>
            );
          })}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {t('admin.mobile.designTools', { defaultValue: 'Design Tools' })}
          </h3>
          <div className={styles.grid}>
            {enabledTools.map((tool) => {
              const ToolIcon = getMobileIcon(tool.icon);
              return (
                <span className={styles.app} key={tool.id}>
                  <span className={styles.appIcon}>
                    <Icon icon={ToolIcon} size={17} />
                  </span>
                  <span className={styles.label}>{tool.label}</span>
                </span>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {t('admin.mobile.appEntries', { defaultValue: 'App Entries' })}
          </h3>
          <div className={styles.grid}>
            {previewApps.map((app) => (
              <span className={styles.app} key={app.id}>
                <span className={styles.appIcon}>
                  <Icon icon={app.icon} size={17} />
                </span>
                <span className={styles.label}>{app.label}</span>
              </span>
            ))}
          </div>
        </section>
      </div>

      <nav
        aria-label={t('admin.mobile.bottomNavigation', { defaultValue: 'Bottom Navigation' })}
        className={styles.nav}
      >
        {visibleTabs.map((item, index) => {
          const TabIcon = getMobileIcon(item.icon);
          return (
            <span
              className={`${styles.navItem} ${index === 0 ? styles.navItemActive : ''}`}
              key={item.id}
            >
              <Icon icon={TabIcon} size={16} />
              <span className={styles.label}>{item.label}</span>
            </span>
          );
        })}
      </nav>
    </div>
  );
});

MobileConfigPreview.displayName = 'MobileConfigPreview';

export default MobileConfigPreview;
