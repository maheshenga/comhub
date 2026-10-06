import { AGENT_CHAT_TOPIC_URL, GROUP_CHAT_TOPIC_URL } from '@lobechat/const';
import type { ChatTopicMetadata, RecentItem } from '@lobechat/types';

import { type MobileWorkspaceRecentDbItem, type RecentDbItem } from '@/database/models/recent';

export type { RecentItem } from '@lobechat/types';

export interface MobileWorkspaceRecentItem {
  avatar?: MobileWorkspaceRecentDbItem['avatar'];
  backgroundColor?: string | null;
  id: string;
  kind: 'agent' | 'group';
  pinned: boolean;
  routePath: string;
  sessionId: string;
  title: string;
  topicTitle?: string;
  unreadCount: number;
  updatedAt: Date;
}

export interface MobileWorkspaceRecentResponse {
  items: MobileWorkspaceRecentItem[];
  nextCursor?: string;
}

export const toRecentItem = (item: RecentDbItem): RecentItem => {
  let routePath: string;

  switch (item.type) {
    case 'topic': {
      if (item.routeGroupId) {
        routePath = GROUP_CHAT_TOPIC_URL(item.routeGroupId, item.id);
      } else if (item.routeId) {
        routePath = AGENT_CHAT_TOPIC_URL(item.routeId, item.id);
      } else {
        routePath = '/';
      }
      break;
    }
    case 'document': {
      routePath = `/page/${item.id}`;
      break;
    }
    case 'task': {
      routePath = item.routeId ? `/agent/${item.routeId}/task/${item.id}` : `/task/${item.id}`;
      break;
    }
  }

  return {
    agentId: item.routeId,
    description: item.description,
    icon: item.type,
    id: item.id,
    lastAssistantMessage: item.lastAssistantMessage,
    metadata: item.metadata as ChatTopicMetadata | undefined,
    routePath,
    slugTitle: item.slugTitle,
    status: item.status,
    title: item.title,
    type: item.type,
    updatedAt: item.updatedAt,
    userId: item.userId,
  };
};

export const toMobileWorkspaceRecentItem = (
  item: MobileWorkspaceRecentDbItem,
): MobileWorkspaceRecentItem => {
  const rootRoute = item.kind === 'group' ? `/group/${item.id}` : `/agent/${item.id}`;
  const topicRoute = item.topic ? toRecentItem(item.topic).routePath : rootRoute;

  return {
    avatar: item.avatar,
    backgroundColor: item.backgroundColor,
    id: item.id,
    kind: item.kind,
    pinned: item.pinned,
    routePath: item.pinned ? rootRoute : topicRoute,
    sessionId: item.id,
    title: item.title,
    topicTitle: item.topic?.title.trim() || undefined,
    unreadCount: item.unreadCount,
    updatedAt: item.topic?.updatedAt ?? item.updatedAt,
  };
};
