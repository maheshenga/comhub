'use client';

import { Button, Empty, Flexbox, Icon, Skeleton } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import useSWR from 'swr';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { mobileDesignService } from '@/services/mobileDesign';
import { usePageStore } from '@/store/page';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import { getMobileIcon } from '../mobileIcons';
import MobilePageLayout from '../MobilePageLayout';
import { useMobileConfig } from '../useMobileConfig';
import { buildMobileDesignTools, getDesignKindLabel, type MobileDesignTool } from './designItems';

const styles = createStaticStyles(({ css, cssVar }) => ({
  createError: css`
    margin-block: 0 8px;
    padding-inline: 16px;
    color: ${cssVar.colorError};
    font-size: 13px;
  `,
  headerTitle: css`
    margin: 0;
    color: ${cssVar.colorText};
    font-size: 17px;
    font-weight: 600;
  `,
  itemIcon: css`
    display: grid;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    place-items: center;
    border-radius: 8px;
    color: ${cssVar.colorPrimary};
    background: ${cssVar.colorFillTertiary};
  `,
  itemMeta: css`
    overflow: hidden;
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  itemText: css`
    min-width: 0;
    flex: 1;
    text-align: start;
  `,
  itemTitle: css`
    overflow: hidden;
    color: ${cssVar.colorText};
    font-size: 15px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  page: css`
    width: 100%;
    padding-block: 8px 16px;
  `,
  recentButton: css`
    display: flex;
    width: 100%;
    min-height: 64px;
    align-items: center;
    gap: 12px;
    padding-block: 10px;
    padding-inline: 16px;
    border: 0;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    color: inherit;
    background: transparent;
    cursor: pointer;

    &:active {
      background: ${cssVar.colorFillQuaternary};
    }
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
    min-height: 176px;
    padding: 24px 16px;
  `,
  toolButton: css`
    display: flex;
    min-width: 0;
    min-height: 82px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 4px;
    border: 0;
    color: ${cssVar.colorText};
    background: transparent;
    cursor: pointer;

    &:active {
      background: ${cssVar.colorFillQuaternary};
    }

    &:disabled {
      cursor: wait;
      opacity: 0.6;
    }
  `,
  toolGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-inline: 8px;
  `,
  toolIcon: css`
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border-radius: 8px;
    color: ${cssVar.colorPrimary};
    background: ${cssVar.colorFillSecondary};
  `,
  toolLabel: css`
    overflow: hidden;
    max-width: 100%;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const formatUpdatedAt = (value: Date) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value));

const MobileDesignPage = memo(() => {
  const navigate = useWorkspaceAwareNavigate();
  const createNewPage = usePageStore((state) => state.createNewPage);
  const { config } = useMobileConfig();
  const [creatingTool, setCreatingTool] = useState<MobileDesignTool['id']>();
  const [createError, setCreateError] = useState<string>();
  const { data, error, isLoading, mutate } = useSWR(
    ['mobile-design-recent', 20],
    () => mobileDesignService.getRecent(20),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const tools = useMemo(() => buildMobileDesignTools(config.design.tools), [config.design.tools]);
  const pageTitle = config.navigation.items.find((item) => item.id === 'slot-2')?.label || 'Design';

  const handleCreate = async (tool: MobileDesignTool) => {
    setCreateError(undefined);

    if (tool.id !== 'document') {
      navigate(tool.routePath, { escape: true });
      return;
    }

    setCreatingTool(tool.id);
    try {
      const id = await createNewPage('Untitled');
      navigate(`/page/${encodeURIComponent(id)}`, { escape: true });
    } catch {
      setCreateError('Unable to create document');
    } finally {
      setCreatingTool(undefined);
    }
  };

  const header = (
    <ChatHeader
      left={<h1 className={styles.headerTitle}>{pageTitle}</h1>}
      style={mobileHeaderSticky}
    />
  );

  return (
    <MobilePageLayout header={header}>
      <main className={styles.page}>
        <section aria-labelledby="mobile-design-create-heading" className={styles.section}>
          <h2 className={styles.sectionHeading} id="mobile-design-create-heading">
            Create
          </h2>
          <div className={styles.toolGrid}>
            {tools.map((tool) => {
              const ToolIcon = getMobileIcon(tool.icon);
              return (
                <button
                  aria-label={`Create ${tool.label}`}
                  className={styles.toolButton}
                  data-testid="mobile-design-tool"
                  disabled={Boolean(creatingTool)}
                  key={tool.id}
                  type="button"
                  onClick={() => void handleCreate(tool)}
                >
                  <span className={styles.toolIcon}>
                    <Icon icon={ToolIcon} size={22} />
                  </span>
                  <span className={styles.toolLabel}>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {createError ? (
          <p className={styles.createError} role="alert">
            {createError}
          </p>
        ) : null}

        <section aria-labelledby="mobile-design-recent-heading" className={styles.section}>
          <h2 className={styles.sectionHeading} id="mobile-design-recent-heading">
            Recent work
          </h2>

          {isLoading ? (
            <Flexbox className={styles.state} data-testid="mobile-design-loading" gap={12}>
              <Skeleton.Paragraph active rows={4} />
            </Flexbox>
          ) : error ? (
            <Flexbox align="center" className={styles.state} gap={12} justify="center">
              <span>Unable to load recent design work</span>
              <Button onClick={() => void mutate()}>Retry</Button>
            </Flexbox>
          ) : data?.length ? (
            <div>
              {data.map((item) => {
                const ItemIcon = getMobileIcon(
                  item.kind === 'document'
                    ? 'file-text'
                    : item.kind === 'image'
                      ? 'image'
                      : 'presentation',
                );
                return (
                  <button
                    aria-label={`Open ${item.title}`}
                    className={styles.recentButton}
                    key={`${item.kind}:${item.id}`}
                    type="button"
                    onClick={() => navigate(item.routePath, { escape: true })}
                  >
                    <span className={styles.itemIcon}>
                      <Icon icon={ItemIcon} size={20} />
                    </span>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemMeta}>
                        {getDesignKindLabel(item.kind)}
                        {item.status ? ` · ${item.status}` : ''}
                      </span>
                    </span>
                    <time
                      className={styles.itemMeta}
                      dateTime={new Date(item.updatedAt).toISOString()}
                    >
                      {formatUpdatedAt(item.updatedAt)}
                    </time>
                  </button>
                );
              })}
            </div>
          ) : (
            <Flexbox className={styles.state} justify="center">
              <Empty description="No recent design work" />
            </Flexbox>
          )}
        </section>
      </main>
    </MobilePageLayout>
  );
});

MobileDesignPage.displayName = 'MobileDesignPage';

export default MobileDesignPage;
