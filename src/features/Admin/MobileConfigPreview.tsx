'use client';

import { Icon, Segmented } from '@lobehub/ui';
import { memo, type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type MobilePublicConfigV1,normalizeMobileConfig } from '@/const/mobileConfig';
import { getMobileIcon } from '@/features/MobileWorkspace/mobileIcons';

import { renderPreviewBody } from './MobileSettings/mobilePreviewBody';
import { previewStyles as styles } from './MobileSettings/mobilePreviewStyles';

type MobilePreviewMode = 'recent' | 'design' | 'discover' | 'apps';

type MobileConfigPreviewProps = {
  config: MobilePublicConfigV1;
};

const previewModeSlot: Record<
  MobilePreviewMode,
  MobilePublicConfigV1['navigation']['items'][number]['id']
> = {
  apps: 'slot-4',
  design: 'slot-2',
  discover: 'slot-3',
  recent: 'slot-1',
};

const previewSlotMode: Record<
  MobilePublicConfigV1['navigation']['items'][number]['id'],
  MobilePreviewMode
> = {
  'slot-1': 'recent',
  'slot-2': 'design',
  'slot-3': 'discover',
  'slot-4': 'apps',
};

const previewRecentRows = [
  {
    labelKey: 'admin.mobile.preview.recent.sample',
    titleKey: 'admin.mobile.preview.recent.sampleTitleOne',
  },
  {
    labelKey: 'admin.mobile.preview.recent.sample',
    titleKey: 'admin.mobile.preview.recent.sampleTitleTwo',
  },
] as const;

const MobileConfigPreview = memo<MobileConfigPreviewProps>(({ config }) => {
  const { t } = useTranslation('subscription');
  const normalizedConfig = useMemo(() => normalizeMobileConfig(config), [config]);
  const [mode, setMode] = useState<MobilePreviewMode>('recent');
  const visibleTabs = useMemo(
    () =>
      normalizedConfig.navigation.items
        .filter((item) => item.visible)
        .sort((left, right) => left.order - right.order),
    [normalizedConfig.navigation.items],
  );
  const enabledTools = useMemo(
    () =>
      normalizedConfig.design.tools
        .filter((tool) => tool.enabled)
        .sort((left, right) => left.order - right.order),
    [normalizedConfig.design.tools],
  );
  const enabledBuiltins = useMemo(
    () =>
      normalizedConfig.applications.builtins
        .filter((app) => app.enabled)
        .sort((left, right) => left.order - right.order),
    [normalizedConfig.applications.builtins],
  );
  const assistants = useMemo(
    () => [...normalizedConfig.discover.assistants].sort((left, right) => left.order - right.order),
    [normalizedConfig.discover.assistants],
  );
  const brandName = normalizedConfig.brand.displayName || 'ComHub';
  const modeOptions = useMemo(
    () => [
      { label: t('admin.mobile.preview.recent'), value: 'recent' },
      { label: t('admin.mobile.preview.design'), value: 'design' },
      { label: t('admin.mobile.preview.discover'), value: 'discover' },
      { label: t('admin.mobile.preview.apps'), value: 'apps' },
    ],
    [t],
  );

  const section = (title: string, children: ReactNode, testId?: string) => (
    <section className={styles.section} data-testid={testId}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
      </div>
      {children}
    </section>
  );

  return (
    <div className={styles.preview}>
      <Segmented
        aria-label={t('admin.mobile.previewMode')}
        options={modeOptions}
        value={mode}
        onChange={(value) => setMode(value as MobilePreviewMode)}
      />
      <div className={styles.frame} data-testid="mobile-config-preview">
        <header className={styles.header}>
          {normalizedConfig.brand.logoUrl ? (
            <img
              alt={brandName}
              className={styles.brandLogo}
              src={normalizedConfig.brand.logoUrl}
            />
          ) : null}
          <span className={styles.brand}>{brandName}</span>
        </header>

        <div className={styles.content}>{renderPreviewBody({ assistants, enabledBuiltins, enabledTools, featuredModuleAppIds: normalizedConfig.applications.featuredModuleAppIds, mode, normalizedConfig, section, t: t as any })}</div>

        <nav
          className={styles.nav}
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
          aria-label={t('admin.mobile.bottomNavigation', {
            defaultValue: 'Bottom Navigation',
          })}
        >
          {visibleTabs.map((item) => {
            const TabIcon = getMobileIcon(item.icon);
            const active = item.id === previewModeSlot[mode];
            return (
              <button
                aria-current={active ? 'page' : undefined}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                data-testid={`mobile-preview-nav-${item.id}`}
                key={item.id}
                type="button"
                onClick={() => setMode(previewSlotMode[item.id])}
              >
                <span className={styles.navIcon}>
                  <Icon icon={TabIcon} size={20} />
                </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
});

MobileConfigPreview.displayName = 'MobileConfigPreview';

export default MobileConfigPreview;
