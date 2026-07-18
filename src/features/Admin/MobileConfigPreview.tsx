'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';

import { type MobilePublicConfigV1, normalizeMobileConfig } from '@/const/mobileConfig';

const styles = createStaticStyles(({ css }) => ({
  frame: css`
    width: 100%;
    min-width: 260px;
    max-width: 360px;
    min-height: 520px;
    padding: 18px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  metric: css`
    display: flex;
    justify-content: space-between;
    padding-block: 8px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
    font-size: 13px;
  `,
  title: css`
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  `,
}));

type MobileConfigPreviewProps = {
  config: MobilePublicConfigV1;
};

const MobileConfigPreview = memo<MobileConfigPreviewProps>(({ config }) => {
  const normalized = normalizeMobileConfig(config);
  const visibleTabs = normalized.navigation.items.filter((item) => item.visible);
  const enabledTools = normalized.design.tools.filter((tool) => tool.enabled);
  const enabledBuiltins = normalized.applications.builtins.filter((app) => app.enabled);

  return (
    <section
      aria-label="Mobile configuration preview"
      className={styles.frame}
      data-testid="mobile-config-preview"
    >
      <Flexbox gap={16}>
        <Flexbox gap={4}>
          <h2 className={styles.title}>{normalized.brand.displayName || 'ComHub'}</h2>
          {normalized.brand.logoUrl ? <span>{normalized.brand.logoUrl}</span> : null}
        </Flexbox>

        <div className={styles.metric}>Visible tabs: {visibleTabs.length}</div>
        <div className={styles.metric}>Enabled tools: {enabledTools.length}</div>
        <div className={styles.metric}>Assistants: {normalized.discover.assistants.length}</div>
        <div className={styles.metric}>
          Module apps: {normalized.applications.featuredModuleAppIds.length}
        </div>
        <div className={styles.metric}>Built-in apps: {enabledBuiltins.length}</div>

        <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
          {visibleTabs.map((item) => (
            <span key={item.id}>{item.label}</span>
          ))}
        </Flexbox>
      </Flexbox>
    </section>
  );
});

MobileConfigPreview.displayName = 'MobileConfigPreview';

export default MobileConfigPreview;
