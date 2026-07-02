import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  WorkspaceAuditLogModel,
  type WorkspaceAuditAction,
} from '@/database/models/workspaceAuditLog';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const workspaceAuditLogProcedure = authedProcedure.use(serverDatabase);

export const workspaceAuditLogRouter = router({
  list: workspaceAuditLogProcedure
    .input(
      z.object({
        action: z.string().optional(),
        cursor: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .default(50)
          .transform((limit) => Math.min(limit, 100)),
        startDate: z.coerce.date().optional(),
        workspaceId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const member = await new WorkspaceMemberModel(ctx.serverDB, ctx.userId).getMember(
        input.workspaceId,
        ctx.userId,
      );

      if (member?.role !== 'owner') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only workspace owners can view audit logs',
        });
      }

      return new WorkspaceAuditLogModel(ctx.serverDB).list({
        action: input.action as WorkspaceAuditAction | undefined,
        cursor: input.cursor,
        endDate: input.endDate,
        limit: input.limit,
        startDate: input.startDate,
        workspaceId: input.workspaceId,
      });
    }),
});
