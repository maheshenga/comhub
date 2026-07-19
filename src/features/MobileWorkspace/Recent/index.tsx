'use client';

import { Button, Empty, Flexbox, SearchBar, Skeleton } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type ChangeEvent, memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWRInfinite from 'swr/infinite';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { recentService } from '@/services/recent';
import { useHomeStore } from '@/store/home';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

import MobileRefreshButton from '../MobileRefreshButton';
import { useMobileSlotState } from '../mobileSlotState';
import RecentConversationRow from './RecentConversationRow';
import { filterMobileRecentItems, type MobileRecentConversation } from './recentItems';

const PAGE_SIZE = 20;

const styles = createStaticStyles(({ css, cssVar }) => ({
  heading: css`
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
  `,
  pinError: css`
    margin-inline: 12px;
    padding-block: 8px;
    font-size: 13px;
    color: ${cssVar.colorError};
  `,
  page: css`
    width: 100%;
    padding-block: 8px 16px;
  `,
  sectionHeader: css`
    padding-block: 8px;
    padding-inline: 12px 8px;
  `,
  search: css`
    padding-block: 4px 8px;
    padding-inline: 12px;
  `,
  state: css`
    min-height: 240px;
    padding: 24px;
  `,
}));

const MobileRecentPage = memo(() => {
  const { t } = useTranslation('common');
  const activeWorkspaceId = useActiveWorkspaceId();
  const isLogin = useUserStore(authSelectors.isLogin);
  const navigate = useWorkspaceAwareNavigate();
  const pinAgent = useHomeStore((state) => state.pinAgent);
  const pinAgentGroup = useHomeStore((state) => state.pinAgentGroup);
  const {
    query: searchQuery,
    rememberFocus,
    setQuery: setSearchQuery,
  } = useMobileSlotState({ scopeId: activeWorkspaceId ?? 'personal', slotId: 'slot-1' });
  const [pinError, setPinError] = useState(false);
  const pinningKeysRef = useRef(new Set<string>());
  const [pinningKeys, setPinningKeys] = useState<Set<string>>(() => new Set());
  const getKey = useCallback(
    (pageIndex: number, previousPageData: Awaited<ReturnType<typeof recentService.getMobileWorkspace>> | null) => {
      if (isLogin === false || (previousPageData && !previousPageData.nextCursor)) return null;
      return [
        'mobile-recent-workspace',
        activeWorkspaceId,
        searchQuery,
        pageIndex === 0 ? undefined : previousPageData?.nextCursor,
      ] as const;
    },
    [activeWorkspaceId, isLogin, searchQuery],
  );
  const { data, error, isLoading, isValidating, mutate, setSize, size } = useSWRInfinite(
    getKey,
    ([, , query, cursor]) =>
      recentService.getMobileWorkspace({ cursor, limit: PAGE_SIZE, query: query || undefined }),
    {
      revalidateAll: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
    },
  );

  const conversations = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const sections = useMemo(
    () =>
      filterMobileRecentItems(
        {
          pinned: conversations.filter((item) => item.pinned),
          recent: conversations.filter((item) => !item.pinned),
        },
        searchQuery,
      ),
    [conversations, searchQuery],
  );
  const hasItems = sections.pinned.length > 0 || sections.recent.length > 0;
  const hasMore = Boolean(data?.at(-1)?.nextCursor);

  const togglePin = useCallback(
    async (item: MobileRecentConversation) => {
      const key = `${item.kind}:${item.id}`;
      if (pinningKeysRef.current.has(key)) return;

      pinningKeysRef.current.add(key);
      setPinningKeys(new Set(pinningKeysRef.current));
      setPinError(false);
      try {
        if (item.kind === 'group') {
          await pinAgentGroup(item.sessionId, !item.pinned);
        } else {
          await pinAgent(item.sessionId, !item.pinned);
        }
        await mutate();
      } catch {
        setPinError(true);
      } finally {
        pinningKeysRef.current.delete(key);
        setPinningKeys(new Set(pinningKeysRef.current));
      }
    },
    [mutate, pinAgent, pinAgentGroup],
  );
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  if (isLoading && isLogin !== false) {
    return (
      <Flexbox
        aria-busy="true"
        className={styles.state}
        data-testid="mobile-recent-loading"
        gap={16}
        role="status"
      >
        <Skeleton.Paragraph active rows={6} />
      </Flexbox>
    );
  }

  if (error) {
    return (
      <Flexbox align="center" className={styles.state} gap={12} justify="center">
        <span role="alert">{t('mobile.recent.error')}</span>
        <Button onClick={() => void refresh()}>{t('retry')}</Button>
      </Flexbox>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.search}>
        <SearchBar
          allowClear
          aria-label={t('mobile.recent.search')}
          placeholder={t('mobile.recent.search')}
          value={searchQuery}
          variant="filled"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
        />
      </div>
      <Flexbox horizontal align="center" className={styles.sectionHeader} justify="space-between">
        <h2 className={styles.heading}>{t('mobile.recent.latest')}</h2>
        <MobileRefreshButton
          label={t('mobile.recent.refresh')}
          loading={isValidating}
          onRefresh={() => void refresh()}
        />
      </Flexbox>
      {pinError ? (
        <div className={styles.pinError} role="alert">
          {t('mobile.recent.pinError')}
        </div>
      ) : null}

      {!hasItems ? (
        <Flexbox className={styles.state} justify="center">
          <Empty
            description={searchQuery ? t('mobile.recent.emptySearch') : t('mobile.recent.empty')}
          />
        </Flexbox>
      ) : (
        <>
          {sections.pinned.length > 0 ? (
            <section aria-label={t('mobile.recent.pinned')}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.heading}>{t('mobile.recent.pinned')}</h3>
              </div>
              {sections.pinned.map((item) => (
                <RecentConversationRow
                  item={item}
                  key={item.id}
                  pending={pinningKeys.has(`${item.kind}:${item.id}`)}
                  onOpen={() => {
                    rememberFocus(`${item.kind}:${item.id}`);
                    navigate(item.routePath);
                  }}
                  onTogglePin={() => void togglePin(item)}
                />
              ))}
            </section>
          ) : null}

          {sections.recent.length > 0 ? (
            <section aria-label={t('mobile.recent.latest')}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.heading}>{t('mobile.recent.latest')}</h3>
              </div>
              {sections.recent.map((item) => (
                <RecentConversationRow
                  item={item}
                  key={item.id}
                  pending={pinningKeys.has(`${item.kind}:${item.id}`)}
                  onOpen={() => {
                    rememberFocus(`${item.kind}:${item.id}`);
                    navigate(item.routePath);
                  }}
                  onTogglePin={() => void togglePin(item)}
                />
              ))}
            </section>
          ) : null}
          {hasMore ? (
            <Flexbox align="center" padding={16}>
              <Button
                aria-label={t('mobile.recent.loadMore')}
                disabled={isValidating}
                loading={isValidating}
                onClick={() => void setSize(size + 1)}
              >
                {t('mobile.recent.loadMore')}
              </Button>
            </Flexbox>
          ) : null}
        </>
      )}
    </main>
  );
});

MobileRecentPage.displayName = 'MobileRecentPage';

export default MobileRecentPage;
