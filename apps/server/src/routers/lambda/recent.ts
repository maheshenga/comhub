import type { TaskStatus } from '@lobechat/types';
import { z } from 'zod';

import { wsCompatProcedure } from '@/business/server/trpc-middlewares/workspaceAuth';
import { AGENT_CHAT_TOPIC_URL } from '@/const/url';
import {
  type MobileWorkspaceRecentDbItem,
  type MobileWorkspaceRecentQuery,
  type RecentDbItem,
  RecentModel,
} from '@/database/models/recent';
import { router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import type { ChatTopicMetadata } from '@/types/topic';

export interface RecentItem {
  agentId?: string | null;
  icon: string;
  id: string;
  metadata?: ChatTopicMetadata;
  routePath: string;
  /** Task lifecycle status when `type === 'task'`; null for topic/document. */
  status: TaskStatus | null;
  title: string;
  type: 'topic' | 'document' | 'task';
  updatedAt: Date;
}

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

const recentProcedure = wsCompatProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      recentModel: new RecentModel(ctx.serverDB, ctx.userId, ctx.workspaceId ?? undefined),
    },
  });
});

const toRecentItem = (item: RecentDbItem): RecentItem => {
  let routePath: string;

  switch (item.type) {
    case 'topic': {
      if (item.routeGroupId) {
        routePath = `/group/${item.routeGroupId}?topic=${item.id}`;
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
    icon: item.type,
    id: item.id,
    metadata: item.metadata as ChatTopicMetadata | undefined,
    routePath,
    status: item.status,
    title: item.title,
    type: item.type,
    updatedAt: item.updatedAt,
  };
};

const toMobileWorkspaceRecentItem = (
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

export const recentRouter = router({
  getAll: recentProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
          types: z.array(z.enum(['topic', 'document', 'task'])).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<RecentItem[]> => {
      const limit = input?.limit ?? 10;

      const items = await ctx.recentModel.queryRecent(limit, input?.types);
      return items.map(toRecentItem);
    }),
  getMobileWorkspace: recentProcedure
    .input(
      z.object({
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(50).default(20),
        query: z.string().trim().max(100).optional(),
      }).strict(),
    )
    .query(async ({ ctx, input }): Promise<MobileWorkspaceRecentResponse> => {
      const result = await ctx.recentModel.queryMobileWorkspace(input satisfies MobileWorkspaceRecentQuery);

      return {
        items: result.items.map(toMobileWorkspaceRecentItem),
        nextCursor: result.nextCursor,
      };
    }),
});

export type RecentRouter = typeof recentRouter;
