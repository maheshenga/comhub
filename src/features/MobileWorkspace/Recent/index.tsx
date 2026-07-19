'use client';

import { Button, Empty, Flexbox, SearchBar, Skeleton } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { RefreshCw } from 'lucide-react';
import { type ChangeEvent, memo, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useFetchSessions } from '@/hooks/useFetchSessions';
import { recentService } from '@/services/recent';
import { useHomeStore } from '@/store/home';
import { useSessionStore } from '@/store/session';

import RecentConversationRow from './RecentConversationRow';
import {
  buildMobileRecentItems,
  filterMobileRecentItems,
  type MobileRecentConversation,
} from './recentItems';

const styles = createStaticStyles(({ css, cssVar }) => ({
  heading: css`
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
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
  useFetchSessions();
  const navigate = useWorkspaceAwareNavigate();
  const sessions = useSessionStore((state) => state.sessions);
  const pinnedSessions = useSessionStore((state) => state.pinnedSessions);
  const sessionsReady = useSessionStore((state) => state.isSessionsFirstFetchFinished);
  const pinSession = useSessionStore((state) => state.pinSession);
  const refreshSessions = useSessionStore((state) => state.refreshSessions);
  const pinAgentGroup = useHomeStore((state) => state.pinAgentGroup);
  const [searchQuery, setSearchQuery] = useState('');
  const { data, error, isLoading, mutate } = useSWR(
    ['mobile-recent', 'topic'],
    () => recentService.getAll({ limit: 50, types: ['topic'] }),
    { refreshInterval: 10_000, revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const sections = useMemo(
    () =>
      filterMobileRecentItems(
        buildMobileRecentItems({
          pinnedSessions,
          recents: data ?? [],
          sessions,
        }),
        searchQuery,
      ),
    [data, pinnedSessions, searchQuery, sessions],
  );
  const hasItems = sections.pinned.length > 0 || sections.recent.length > 0;

  const togglePin = useCallback(
    async (item: MobileRecentConversation) => {
      if (item.kind === 'group' || item.kind === 'group-topic') {
        await pinAgentGroup(item.sessionId, !item.pinned);
        await refreshSessions();
        return;
      }
      await pinSession(item.sessionId, !item.pinned);
    },
    [pinAgentGroup, pinSession, refreshSessions],
  );

  if (isLoading || !sessionsReady) {
    return (
      <Flexbox className={styles.state} data-testid="mobile-recent-loading" gap={16}>
        <Skeleton.Paragraph active rows={6} />
      </Flexbox>
    );
  }

  if (error) {
    return (
      <Flexbox align="center" className={styles.state} gap={12} justify="center">
        <span>Failed to load recent conversations</span>
        <Button onClick={() => void mutate()}>Retry</Button>
      </Flexbox>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.search}>
        <SearchBar
          allowClear
          aria-label="Search conversations"
          placeholder="Search conversations"
          value={searchQuery}
          variant="filled"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
        />
      </div>
      <Flexbox horizontal align="center" className={styles.sectionHeader} justify="space-between">
        <h2 className={styles.heading}>Recent</h2>
        <Button
          aria-label="Refresh recent conversations"
          icon={<RefreshCw size={16} />}
          title="Refresh recent conversations"
          onClick={() => void mutate()}
        />
      </Flexbox>

      {!hasItems ? (
        <Flexbox className={styles.state} justify="center">
          <Empty
            description={searchQuery ? 'No matching conversations' : 'No recent conversations'}
          />
        </Flexbox>
      ) : (
        <>
          {sections.pinned.length > 0 ? (
            <section aria-label="Pinned conversations">
              <div className={styles.sectionHeader}>
                <h3 className={styles.heading}>Pinned</h3>
              </div>
              {sections.pinned.map((item) => (
                <RecentConversationRow
                  item={item}
                  key={item.id}
                  onOpen={() => navigate(item.routePath)}
                  onTogglePin={() => void togglePin(item)}
                />
              ))}
            </section>
          ) : null}

          {sections.recent.length > 0 ? (
            <section aria-label="Recent conversations">
              <div className={styles.sectionHeader}>
                <h3 className={styles.heading}>Latest</h3>
              </div>
              {sections.recent.map((item) => (
                <RecentConversationRow
                  item={item}
                  key={item.id}
                  onOpen={() => navigate(item.routePath)}
                  onTogglePin={() => void togglePin(item)}
                />
              ))}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
});

MobileRecentPage.displayName = 'MobileRecentPage';

export default MobileRecentPage;
