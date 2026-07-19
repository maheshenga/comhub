'use client';

import { Avatar, Button, Empty, Flexbox, Skeleton } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import MobilePageLayout from '../MobilePageLayout';
import { useMobileConfig } from '../useMobileConfig';
import { buildFeaturedAssistantCards } from './featuredAssistants';

const styles = createStaticStyles(({ css, cssVar }) => ({
  avatar: css`
    flex: 0 0 auto;
  `,
  card: css`
    display: flex;
    min-width: 0;
    min-height: 164px;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    color: inherit;
    background: ${cssVar.colorBgContainer};
    cursor: pointer;
    text-align: start;

    &:active {
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  description: css`
    display: -webkit-box;
    overflow: hidden;
    color: ${cssVar.colorTextSecondary};
    font-size: 13px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 12px;
  `,
  headerTitle: css`
    overflow: hidden;
    margin: 0;
    color: ${cssVar.colorText};
    font-size: 17px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  model: css`
    overflow: hidden;
    max-width: 100%;
    margin-block-start: auto;
    padding-block: 3px;
    padding-inline: 7px;
    border-radius: 6px;
    color: ${cssVar.colorPrimary};
    background: ${cssVar.colorFillSecondary};
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  page: css`
    width: 100%;
    padding-block: 8px 16px;
  `,
  state: css`
    min-height: 280px;
    padding: 32px 20px;
  `,
  title: css`
    display: -webkit-box;
    overflow: hidden;
    color: ${cssVar.colorText};
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
}));

const MobileDiscoverPage = memo(() => {
  const navigate = useWorkspaceAwareNavigate();
  const { config, error, isLoading, mutate } = useMobileConfig();
  const cards = useMemo(
    () => buildFeaturedAssistantCards(config.discover.featuredAssistants ?? []),
    [config.discover.featuredAssistants],
  );
  const header = (
    <ChatHeader
      left={<h1 className={styles.headerTitle}>{config.discover.title}</h1>}
      style={mobileHeaderSticky}
    />
  );

  return (
    <MobilePageLayout header={header}>
      <main className={styles.page}>
        {isLoading ? (
          <Flexbox className={styles.state} data-testid="mobile-discover-loading" gap={12}>
            <Skeleton.Paragraph active rows={6} />
          </Flexbox>
        ) : error ? (
          <Flexbox align="center" className={styles.state} gap={12} justify="center">
            <span>Unable to load recommended assistants</span>
            <Button onClick={() => void mutate()}>Retry</Button>
          </Flexbox>
        ) : cards.length === 0 ? (
          <Flexbox className={styles.state} justify="center">
            <Empty description="No recommended assistants" />
          </Flexbox>
        ) : (
          <section aria-label={config.discover.title} className={styles.grid}>
            {cards.map((card) => (
              <button
                aria-label={`Open ${card.title}`}
                className={styles.card}
                data-testid="featured-assistant-card"
                key={card.identifier}
                type="button"
                onClick={() => navigate(card.routePath, { escape: true })}
              >
                <Avatar
                  avatar={card.avatar}
                  className={styles.avatar}
                  shape="square"
                  size={44}
                  title={card.title}
                />
                <span className={styles.title}>{card.title}</span>
                <span className={styles.description}>{card.description}</span>
                <span className={styles.model}>{card.model.displayName}</span>
              </button>
            ))}
          </section>
        )}
      </main>
    </MobilePageLayout>
  );
});

MobileDiscoverPage.displayName = 'MobileDiscoverPage';

export default MobileDiscoverPage;
