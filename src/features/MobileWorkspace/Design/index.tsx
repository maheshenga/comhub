'use client';

import { Button, Empty, Flexbox, Icon, Skeleton } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { mobileDesignService } from '@/services/mobileDesign';
import { usePageStore } from '@/store/page';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import { getMobileIcon } from '../mobileIcons';
import MobilePageLayout from '../MobilePageLayout';
import MobileRefreshButton from '../MobileRefreshButton';
import { useMobileSlotState } from '../mobileSlotState';
import { useMobileConfig } from '../useMobileConfig';
import { buildMobileDesignTools, type MobileDesignTool } from './designItems';

const styles = createStaticStyles(({ css, cssVar }) => ({
  createError: css`
    margin-block: 0 8px;
    padding-inline: 16px;
    font-size: 13px;
    color: ${cssVar.colorError};
  `,
  headerTitle: css`
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  itemIcon: css`
    display: grid;
    flex: 0 0 40px;
    place-items: center;

    width: 40px;
    height: 40px;
    border-radius: 8px;

    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorFillTertiary};
  `,
  itemMeta: css`
    overflow: hidden;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  itemText: css`
    flex: 1;
    min-width: 0;
    text-align: start;
  `,
  itemTitle: css`
    overflow: hidden;

    font-size: 15px;
    font-weight: 500;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  page: css`
    width: 100%;
    padding-block: 8px 16px;
  `,
  recentButton: css`
    cursor: pointer;

    display: flex;
    gap: 12px;
    align-items: center;

    width: 100%;
    min-height: 64px;
    padding-block: 10px;
    padding-inline: 16px;
    border: 0;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    color: inherit;

    background: transparent;

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

    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
  `,
  state: css`
    min-height: 176px;
    padding-block: 24px;
    padding-inline: 16px;
  `,
  toolButton: css`
    cursor: pointer;

    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;

    min-width: 0;
    min-height: 82px;
    padding-block: 8px;
    padding-inline: 4px;
    border: 0;

    color: ${cssVar.colorText};

    background: transparent;

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
    place-items: center;

    width: 44px;
    height: 44px;
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
  const { t } = useTranslation('common');
  const navigate = useWorkspaceAwareNavigate();
  const activeWorkspaceId = useActiveWorkspaceId();
  const createNewPage = usePageStore((state) => state.createNewPage);
  const { config } = useMobileConfig();
  const [creatingTool, setCreatingTool] = useState<MobileDesignTool['id']>();
  const [createError, setCreateError] = useState<string>();
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['mobile-design-recent', activeWorkspaceId, 20],
    () => mobileDesignService.getRecent(20),
    { revalidateOnFocus: true, revalidateOnReconnect: true, shouldRetryOnError: false },
  );
  const { rememberFocus } = useMobileSlotState({
    scopeId: activeWorkspaceId ?? 'personal',
    slotId: 'slot-2',
  });

  const tools = useMemo(() => buildMobileDesignTools(config.design.tools), [config.design.tools]);
  const pageTitle = config.navigation.items.find((item) => item.id === 'slot-2')?.label || 'Design';

  const handleCreate = async (tool: MobileDesignTool) => {
    setCreateError(undefined);

    if (tool.id !== 'document') {
      navigate(tool.routePath);
      return;
    }

    setCreatingTool(tool.id);
    try {
      const id = await createNewPage(t('mobile.design.untitled'));
      navigate(`/page/${encodeURIComponent(id)}`);
    } catch {
      setCreateError(t('mobile.design.createError'));
    } finally {
      setCreatingTool(undefined);
    }
  };

  const header = (
    <ChatHeader
      left={<h1 className={styles.headerTitle}>{pageTitle}</h1>}
      right={
        <MobileRefreshButton
          label={t('mobile.refresh')}
          loading={isValidating}
          onRefresh={() => void mutate()}
        />
      }
      style={mobileHeaderSticky}
    />
  );

  return (
    <MobilePageLayout header={header}>
      <main className={styles.page}>
        <section aria-labelledby="mobile-design-create-heading" className={styles.section}>
          <h2 className={styles.sectionHeading} id="mobile-design-create-heading">
            {t('mobile.design.create')}
          </h2>
          <div className={styles.toolGrid}>
            {tools.map((tool) => {
              const ToolIcon = getMobileIcon(tool.icon);
              return (
                <button
                  aria-label={t('mobile.design.createTool', { name: tool.label })}
                  className={styles.toolButton}
                  data-mobile-focus-key={`tool:${tool.id}`}
                  data-testid="mobile-design-tool"
                  disabled={Boolean(creatingTool)}
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    rememberFocus(`tool:${tool.id}`);
                    void handleCreate(tool);
                  }}
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
            {t('mobile.design.recent')}
          </h2>

          {isLoading ? (
            <Flexbox
              aria-busy="true"
              className={styles.state}
              data-testid="mobile-design-loading"
              gap={12}
              role="status"
            >
              <Skeleton.Paragraph active rows={4} />
            </Flexbox>
          ) : error ? (
            <Flexbox align="center" className={styles.state} gap={12} justify="center">
              <span role="alert">{t('mobile.design.error')}</span>
              <Button onClick={() => void mutate()}>{t('mobile.design.retry')}</Button>
            </Flexbox>
          ) : data?.length ? (
            <div>
              {data.map((item) => {
                const startsNewPresentation = item.kind === 'ppt' && item.resumeSupported === false;
                const ItemIcon = getMobileIcon(
                  item.kind === 'document'
                    ? 'file-text'
                    : item.kind === 'image'
                      ? 'image'
                      : 'presentation',
                );
                return (
                  <button
                    className={styles.recentButton}
                    data-mobile-focus-key={`${item.kind}:${item.id}`}
                    key={`${item.kind}:${item.id}`}
                    type="button"
                    aria-label={
                      startsNewPresentation
                        ? t('mobile.design.startNewPresentation')
                        : t('mobile.design.open', { name: item.title })
                    }
                    onClick={() => {
                      rememberFocus(`${item.kind}:${item.id}`);
                      navigate(item.routePath);
                    }}
                  >
                    <span className={styles.itemIcon}>
                      <Icon icon={ItemIcon} size={20} />
                    </span>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemMeta}>
                        {t(`mobile.design.kind.${item.kind}`)}
                        {startsNewPresentation
                          ? ` · ${t('mobile.design.startNewPresentation')}`
                          : item.status
                            ? ` · ${item.status}`
                            : ''}
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
              <Empty description={t('mobile.design.empty')} />
            </Flexbox>
          )}
        </section>
      </main>
    </MobilePageLayout>
  );
});

MobileDesignPage.displayName = 'MobileDesignPage';

export default MobileDesignPage;
