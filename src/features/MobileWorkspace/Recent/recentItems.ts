import type { RecentItem } from '@/server/routers/lambda/recent';
import { type LobeSession, type LobeSessions, LobeSessionType } from '@/types/session';

export interface MobileRecentConversation {
  avatar?: string;
  id: string;
  kind: 'agent' | 'group' | 'group-topic' | 'topic';
  pinned: boolean;
  routePath: string;
  sessionId: string;
  title: string;
  updatedAt: Date;
}

export interface MobileRecentSections {
  pinned: MobileRecentConversation[];
  recent: MobileRecentConversation[];
}

interface BuildMobileRecentItemsInput {
  pinnedSessions: LobeSessions;
  recents: RecentItem[];
  sessions: LobeSessions;
}

const sessionTitle = (session: LobeSession) => {
  const title = session.meta?.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  return session.type === LobeSessionType.Group ? 'Untitled Group' : 'Untitled Assistant';
};

const sessionAvatar = (session: LobeSession) => {
  const avatar = session.meta?.avatar;
  return typeof avatar === 'string' && avatar.trim() ? avatar : undefined;
};

const parseRecentParent = (item: RecentItem) => {
  try {
    const url = new URL(item.routePath, 'https://mobile.local');
    const [kind, routeId] = url.pathname.split('/').filter(Boolean);
    if (kind === 'group' && routeId) return { kind: 'group-topic' as const, sessionId: routeId };
    if (kind === 'agent') {
      const sessionId = item.agentId || routeId;
      if (sessionId) return { kind: 'topic' as const, sessionId };
    }
  } catch {
    return;
  }
};

const byNewest = (left: MobileRecentConversation, right: MobileRecentConversation) =>
  right.updatedAt.getTime() - left.updatedAt.getTime();

export const buildMobileRecentItems = ({
  pinnedSessions,
  recents,
  sessions,
}: BuildMobileRecentItemsInput): MobileRecentSections => {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const pinnedIds = new Set(pinnedSessions.map((session) => session.id));
  const seenPinnedIds = new Set<string>();
  const pinned = pinnedSessions
    .filter((session) => {
      if (seenPinnedIds.has(session.id)) return false;
      seenPinnedIds.add(session.id);
      return true;
    })
    .map((session): MobileRecentConversation => ({
      avatar: sessionAvatar(session),
      id: `session:${session.id}`,
      kind: session.type === LobeSessionType.Group ? 'group' : 'agent',
      pinned: true,
      routePath:
        session.type === LobeSessionType.Group ? `/group/${session.id}` : `/agent/${session.id}`,
      sessionId: session.id,
      title: sessionTitle(session),
      updatedAt: session.updatedAt,
    }))
    .sort((left, right) => {
      const typeOrder = Number(left.kind === 'group') - Number(right.kind === 'group');
      return typeOrder || byNewest(left, right);
    });

  const seenRecentIds = new Set<string>();
  const recent = recents
    .filter((item) => item.type === 'topic')
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .map((item): MobileRecentConversation | undefined => {
      if (seenRecentIds.has(item.id)) return;
      seenRecentIds.add(item.id);
      const parent = parseRecentParent(item);
      if (!parent || pinnedIds.has(parent.sessionId)) return;
      const parentSession = sessionsById.get(parent.sessionId);
      if (!parentSession) return;

      return {
        avatar: sessionAvatar(parentSession),
        id: item.id,
        kind: parent.kind,
        pinned: false,
        routePath: item.routePath,
        sessionId: parent.sessionId,
        title: item.title.trim() || 'Untitled Topic',
        updatedAt: item.updatedAt,
      };
    })
    .filter((item): item is MobileRecentConversation => Boolean(item));

  return { pinned, recent };
};

export const filterMobileRecentItems = (
  sections: MobileRecentSections,
  rawQuery: string,
): MobileRecentSections => {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return sections;
  const matches = (item: MobileRecentConversation) =>
    item.title.toLocaleLowerCase().includes(query);
  return {
    pinned: sections.pinned.filter(matches),
    recent: sections.recent.filter(matches),
  };
};
