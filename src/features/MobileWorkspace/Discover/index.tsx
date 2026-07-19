'use client';

import { Avatar, Button, Empty, Flexbox, Skeleton } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import MobilePageLayout from '../MobilePageLayout';
import MobileRefreshButton from '../MobileRefreshButton';
import { useMobileSlotState } from '../mobileSlotState';
import { useMobileConfig } from '../useMobileConfig';
import { buildFeaturedAssistantCards } from './featuredAssistants';

const styles = createStaticStyles(({ css, cssVar }) => ({
  avatar: css`
    flex: 0 0 auto;
  `,
  card: css`
    cursor: pointer;

    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;

    min-width: 0;
    min-height: 164px;
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    color: inherit;
    text-align: start;

    background: ${cssVar.colorBgContainer};

    &:active {
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  description: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;

    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
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

    font-size: 17px;
    font-weight: 600;
    color: ${cssVar.colorText};
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

    font-size: 11px;
    color: ${cssVar.colorPrimary};
    text-overflow: ellipsis;
    white-space: nowrap;

    background: ${cssVar.colorFillSecondary};
  `,
  page: css`
    width: 100%;
    padding-block: 8px 16px;
  `,
  state: css`
    min-height: 280px;
    padding-block: 32px;
    padding-inline: 20px;
  `,
  title: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;

    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
}));

const MobileDiscoverPage = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useWorkspaceAwareNavigate();
  const { config, error, isLoading, isValidating, mutate } = useMobileConfig();
  const { rememberFocus } = useMobileSlotState({ scopeId: 'global', slotId: 'slot-3' });
  const cards = useMemo(
    () => buildFeaturedAssistantCards(config.discover.featuredAssistants ?? []),
    [config.discover.featuredAssistants],
  );
  const header = (
    <ChatHeader
      left={<h1 className={styles.headerTitle}>{config.discover.title}</h1>}
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
        {isLoading ? (
          <Flexbox
            aria-busy="true"
            className={styles.state}
            data-testid="mobile-discover-loading"
            gap={12}
            role="status"
          >
            <Skeleton.Paragraph active rows={6} />
          </Flexbox>
        ) : error ? (
          <Flexbox align="center" className={styles.state} gap={12} justify="center">
            <span role="alert">{t('mobile.discover.error')}</span>
            <Button onClick={() => void mutate()}>{t('mobile.discover.retry')}</Button>
          </Flexbox>
        ) : cards.length === 0 ? (
          <Flexbox className={styles.state} justify="center">
            <Empty description={t('mobile.discover.empty')} />
          </Flexbox>
        ) : (
          <section aria-label={config.discover.title} className={styles.grid}>
            {cards.map((card) => (
              <button
                aria-label={t('mobile.discover.open', { name: card.title })}
                className={styles.card}
                data-mobile-focus-key={`assistant:${card.identifier}`}
                data-testid="featured-assistant-card"
                key={card.identifier}
                type="button"
                onClick={() => {
                  rememberFocus(`assistant:${card.identifier}`);
                  navigate(card.routePath, { escape: true });
                }}
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
