'use client';

import { Avatar } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { RefreshCw } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import {
  MobileContentFrame,
  MobileListSkeleton,
  MobileSection,
  MobileStateView,
  MobileWorkspaceHeader,
} from '../components';
import MobilePageLayout from '../MobilePageLayout';
import { useMobileSlotState } from '../mobileSlotState';
import { useMobileConfig } from '../useMobileConfig';
import { buildFeaturedAssistantCards } from './featuredAssistants';

const styles = createStaticStyles(({ css, cssVar }) => ({
  avatar: css`
    flex: 0 0 auto;
  `,
  description: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;

    font-size: 13px;
    line-height: 18px;
    color: ${cssVar.colorTextSecondary};
  `,
  list: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr);

    @media (width >= 640px) and (orientation: landscape) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 16px;
    }
  `,
  model: css`
    overflow: hidden;

    width: 88px;
    max-width: 88px;

    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorTextTertiary};
    text-align: end;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  page: css`
    width: 100%;
    padding-block: 12px 20px;
  `,
  row: css`
    cursor: pointer;

    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 88px;
    gap: 12px;
    align-items: center;

    width: 100%;
    min-height: 76px;
    padding-block: 8px;
    padding-inline: 0;
    border: 0;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    color: inherit;
    text-align: start;

    background: transparent;

    &:active {
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  section: css`
    padding-block: 4px 12px;
  `,
  text: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,
  title: css`
    overflow: hidden;

    font-size: 15px;
    font-weight: 600;
    line-height: 22px;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
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

  return (
    <MobilePageLayout
      header={
        <MobileWorkspaceHeader
          style={mobileHeaderSticky}
          title={t('tab.discover')}
          actions={[
            {
              disabled: isValidating,
              icon: RefreshCw,
              label: t('mobile.refresh'),
              onClick: () => void mutate(),
            },
          ]}
        />
      }
    >
      <main className={styles.page}>
        <MobileContentFrame>
          <MobileSection className={styles.section} title={config.discover.title}>
            {isLoading ? (
              <MobileListSkeleton
                avatarSize={44}
                className={styles.list}
                label={config.discover.title}
                minRowHeight={76}
                rows={4}
                trailingWidth={88}
              />
            ) : error ? (
              <MobileStateView
                action={{ label: t('mobile.discover.retry'), onClick: () => void mutate() }}
                title={t('mobile.discover.error')}
                variant="error"
              />
            ) : cards.length === 0 ? (
              <MobileStateView
                description={t('mobile.discover.emptyDescription')}
                title={t('mobile.discover.empty')}
                actions={[
                  {
                    label: t('mobile.discover.browseCommunity'),
                    onClick: () => navigate('/community', { escape: true }),
                  },
                ]}
              />
            ) : (
              <div
                aria-label={config.discover.title}
                className={styles.list}
                data-testid="featured-assistant-list"
              >
                {cards.map((card) => (
                  <button
                    aria-label={t('mobile.discover.open', { name: card.title })}
                    className={styles.row}
                    data-mobile-focus-key={`assistant:${card.identifier}`}
                    data-testid="featured-assistant-row"
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
                    <span className={styles.text}>
                      <span className={styles.title} data-testid="featured-assistant-title">
                        {card.title}
                      </span>
                      <span
                        className={styles.description}
                        data-clamp-lines="2"
                        data-testid="featured-assistant-description"
                      >
                        {card.description}
                      </span>
                    </span>
                    <span
                      className={styles.model}
                      data-testid="featured-assistant-model"
                      title={card.model.displayName}
                    >
                      {card.model.displayName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </MobileSection>
        </MobileContentFrame>
      </main>
    </MobilePageLayout>
  );
});

MobileDiscoverPage.displayName = 'MobileDiscoverPage';

export default MobileDiscoverPage;
