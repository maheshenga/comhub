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
  pill: css`
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding-block: 4px;
    padding-inline: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 6px;
    font-size: 12px;
  `,
  previewGroup: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  previewLabel: css`
    margin: 0;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
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
    <div className={styles.frame} data-testid="mobile-config-preview">
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

        <p className={styles.previewLabel}>Visible tabs</p>
        <div className={styles.previewGroup}>
          {visibleTabs.map((item) => (
            <span className={styles.pill} key={item.id}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </span>
          ))}
        </div>

        <p className={styles.previewLabel}>Enabled tools</p>
        <div className={styles.previewGroup}>
          {enabledTools.map((tool) => (
            <span className={styles.pill} key={tool.id}>
              <span>{tool.icon}</span>
              <span>{tool.label}</span>
            </span>
          ))}
        </div>

        <p className={styles.previewLabel}>Featured assistants</p>
        <div className={styles.previewGroup}>
          {normalized.discover.assistants.map((assistant) => (
            <span className={styles.pill} key={assistant.assistantId}>
              {assistant.titleOverride ?? assistant.assistantId}
            </span>
          ))}
        </div>

        <p className={styles.previewLabel}>Module apps</p>
        <div className={styles.previewGroup}>
          {normalized.applications.featuredModuleAppIds.map((id) => (
            <span className={styles.pill} key={id}>
              {id}
            </span>
          ))}
        </div>

        <p className={styles.previewLabel}>Built-in apps</p>
        <div className={styles.previewGroup}>
          {enabledBuiltins.map((app) => (
            <span className={styles.pill} key={app.id}>
              <span>{app.icon}</span>
              <span>{app.label}</span>
            </span>
          ))}
        </div>
      </Flexbox>
    </div>
  );
});

MobileConfigPreview.displayName = 'MobileConfigPreview';

export default MobileConfigPreview;
