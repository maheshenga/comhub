'use client';

import { Icon } from '@lobehub/ui';
import { Boxes } from 'lucide-react';
import { type ReactNode } from 'react';

import type { MobilePublicConfigV1 } from '@/const/mobileConfig';
import { getMobileIcon } from '@/features/MobileWorkspace/mobileIcons';

import { previewStyles as styles } from './mobilePreviewStyles';

type TFn = (key: any, options?: Record<string, unknown>) => any;

export interface MobilePreviewBodyParams {
  assistants: Array<{
    assistantId: string;
    descriptionOverride?: string;
    modelLabelOverride?: string;
    order: number;
    titleOverride?: string;
  }>;
  enabledBuiltins: Array<{ icon: string; id: string; label: string; order: number }>;
  enabledTools: Array<{ icon: string; id: string; label: string; order: number }>;
  featuredModuleAppIds: string[];
  normalizedConfig: MobilePublicConfigV1;
  t: TFn;
}

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

/**
 * 预览主体四分支（M5 拆页：从 MobileConfigPreview 抽出）。
 * renderPreviewBody 负责渲染 recent/design/discover/apps 四种预览内容。
 */
export const renderPreviewBody = ({
  mode,
  section,
  ...params
}: MobilePreviewBodyParams & {
  mode: 'apps' | 'design' | 'discover' | 'recent';
  section: (title: string, children: ReactNode, testId?: string) => ReactNode;
}): ReactNode => {
  const { assistants, enabledBuiltins, enabledTools, featuredModuleAppIds, normalizedConfig, t } =
    params;

  switch (mode) {
    case 'design': {
      return section(
        t('admin.mobile.designTools'),
        <div className={styles.grid} data-testid="mobile-preview-design-tools">
          {enabledTools.map((tool) => {
            const ToolIcon = getMobileIcon(tool.icon);
            return (
              <div
                className={styles.designCell}
                data-preview-cell-height="88"
                data-preview-cell-kind="design"
                data-preview-label-lines="1"
                data-testid="mobile-preview-grid-item"
                key={tool.id}
              >
                <span className={styles.appIcon}>
                  <Icon icon={ToolIcon} size={22} />
                </span>
                <span className={styles.designLabel}>{tool.label}</span>
              </div>
            );
          })}
        </div>,
      );
    }

    case 'discover': {
      return (
        <>
          {section(
            normalizedConfig.discover.title || t('admin.mobile.featuredAssistants'),
            <div data-testid="mobile-preview-discover-list">
              {assistants.map((assistant) => {
                const title = assistant.titleOverride || assistant.assistantId;
                return (
                  <div
                    className={styles.assistantRow}
                    data-testid="mobile-preview-assistant-row"
                    key={assistant.assistantId}
                  >
                    <span className={styles.assistantAvatar}>
                      {title.slice(0, 1).toUpperCase()}
                    </span>
                    <span className={styles.assistantText}>
                      <span className={styles.assistantName}>{title}</span>
                      {assistant.descriptionOverride ? (
                        <span className={styles.assistantMeta}>
                          {assistant.descriptionOverride}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.assistantMeta}>
                      {assistant.modelLabelOverride || '推荐'}
                    </span>
                  </div>
                );
              })}
            </div>,
          )}
          {normalizedConfig.discover.community.enabled
            ? section(
                normalizedConfig.discover.community.title,
                <div className={styles.recentText} data-testid="mobile-preview-community">
                  <span className={styles.recentTitle}>Recommended assistants</span>
                  <span className={styles.recentMeta}>Community tools and creators</span>
                </div>,
              )
            : null}
        </>
      );
    }

    case 'apps': {
      return (
        <>
          {section(
            t('admin.mobile.preview.builtinApps'),
            <div className={`${styles.grid} ${styles.appGrid}`}>
              {enabledBuiltins.map((app) => {
                const AppIcon = getMobileIcon(app.icon);
                return (
                  <div
                    className={styles.appCell}
                    data-preview-cell-height="104"
                    data-preview-cell-kind="app"
                    data-preview-label-lines="2"
                    data-testid="mobile-preview-grid-item"
                    key={app.id}
                  >
                    <span className={styles.appIcon}>
                      <Icon icon={AppIcon} size={22} />
                    </span>
                    <span className={styles.appLabel}>{app.label}</span>
                  </div>
                );
              })}
            </div>,
            'mobile-preview-apps-builtins',
          )}
          {section(
            t('admin.mobile.preview.moduleApps'),
            <div className={`${styles.grid} ${styles.appGrid}`}>
              {featuredModuleAppIds.map((id) => (
                <div
                  className={styles.appCell}
                  data-preview-cell-height="104"
                  data-preview-cell-kind="app"
                  data-preview-label-lines="2"
                  data-testid="mobile-preview-grid-item"
                  key={id}
                >
                  <span className={styles.appIcon}>
                    <Icon icon={Boxes} size={22} />
                  </span>
                  <span className={styles.appLabel}>{id}</span>
                </div>
              ))}
            </div>,
            'mobile-preview-apps-modules',
          )}
        </>
      );
    }

    default: {
      return section(
        t('admin.mobile.preview.recentTitle'),
        <div>
          {previewRecentRows.map((row) => {
            const title = t(row.titleKey);
            return (
              <div
                className={styles.recentRow}
                data-testid="mobile-preview-recent-row"
                key={row.titleKey}
              >
                <span className={styles.recentAvatar}>{title.slice(0, 1)}</span>
                <span className={styles.recentText}>
                  <span className={styles.recentTitle}>{title}</span>
                  <span className={styles.recentMeta}>{t(row.labelKey)}</span>
                </span>
              </div>
            );
          })}
        </div>,
      );
    }
  }
};
