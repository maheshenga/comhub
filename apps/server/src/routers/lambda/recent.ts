import type { RecentItem } from '@lobechat/types';
import { z } from 'zod';

import { wsCompatProcedure } from '@/business/server/trpc-middlewares/workspaceAuth';
import { type MobileWorkspaceRecentQuery, RecentModel } from '@/database/models/recent';
import { router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import {
  type MobileWorkspaceRecentResponse,
  toMobileWorkspaceRecentItem,
  toRecentItem,
} from './recentMobileWorkspaceEndpoint';

export type { RecentItem } from '@lobechat/types';
export type {
  MobileWorkspaceRecentItem,
  MobileWorkspaceRecentResponse,
} from './recentMobileWorkspaceEndpoint';

const recentProcedure = wsCompatProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      recentModel: new RecentModel(ctx.serverDB, ctx.userId, ctx.workspaceId ?? undefined),
    },
  });
});

export const recentRouter = router({
  getAll: recentProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
          /** Restrict a workspace feed to the viewer's own items (mine/team toggle). */
          mineOnly: z.boolean().optional(),
          /**
           * Restrict a workspace feed to conversations the whole team can see —
           * topics owned by a private agent/group are dropped even for their
           * own creator. Set by the home "team" tab.
           */
          sharedOnly: z.boolean().optional(),
          types: z.array(z.enum(['topic', 'document', 'task'])).optional(),
          withTopicPreview: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<RecentItem[]> => {
      const limit = input?.limit ?? 10;

      const items = await ctx.recentModel.queryRecent(
        limit,
        input?.types,
        input?.withTopicPreview,
        input?.mineOnly,
        input?.sharedOnly,
      );
      return items.map(toRecentItem);
    }),
  getMobileWorkspace: recentProcedure
    .input(
      z
        .object({
          cursor: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(50).default(20),
          query: z.string().trim().max(100).optional(),
        })
        .strict(),
    )
    .query(async ({ ctx, input }): Promise<MobileWorkspaceRecentResponse> => {
      const result = await ctx.recentModel.queryMobileWorkspace(
        input satisfies MobileWorkspaceRecentQuery,
      );

      return {
        items: result.items.map(toMobileWorkspaceRecentItem),
        nextCursor: result.nextCursor,
      };
    }),
});

export type RecentRouter = typeof recentRouter;
