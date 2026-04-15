import { z } from 'zod';

import { SiteConfigModel } from '@/database/models/siteConfig';
import { adminProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { invalidateSiteConfigCache } from '@/server/globalConfig/getSiteConfig';
import { invalidateGatewayConfigCache } from '@/server/modules/ModelRuntime/platformProvider';

export const siteConfigRouter = router({
  /**
   * Public: get non-encrypted site config as a key-value map.
   * Used by the frontend to read brand_name, site_title, etc.
   */
  getPublic: publicProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const model = new SiteConfigModel(ctx.serverDB);
    return model.getPublicMap();
  }),

  /**
   * Admin: get all config rows (including encrypted flag, timestamps).
   */
  getAll: adminProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const model = new SiteConfigModel(ctx.serverDB);
    return model.getAll();
  }),

  /**
   * Admin: update a single config key.
   */
  set: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        key: z.string().min(1).max(128),
        value: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const model = new SiteConfigModel(ctx.serverDB);
      const result = model.set(input.key, input.value, ctx.userId ?? undefined);
      invalidateSiteConfigCache();
      invalidateGatewayConfigCache();
      return result;
    }),

  /**
   * Admin: bulk-update multiple config keys at once.
   */
  bulkSet: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        entries: z.array(
          z.object({
            key: z.string().min(1).max(128),
            value: z.string().nullable(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const model = new SiteConfigModel(ctx.serverDB);
      await model.bulkSet(input.entries, ctx.userId ?? undefined);
      invalidateSiteConfigCache();
      invalidateGatewayConfigCache();
      return { success: true };
    }),
});
