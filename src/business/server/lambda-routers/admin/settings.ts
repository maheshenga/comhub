import { and, eq, lt } from 'drizzle-orm';
import { z } from 'zod';

import { adminAuditLogs, appSettings, topUpOrders } from '@/database/schemas';
import { adminProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { getResolvedServerDefaultAgentConfig } from '@/server/globalConfig';
import { invalidateServerBrand } from '@/server/services/brand';
import {
  APP_SETTING_KEYS,
  getServerManagedDefaultModelSuggestions,
  getServerManagedNewApiModelIds,
  invalidateServerAppSettings,
  serializeModelIdList,
  serializeUrlList,
} from '@/server/services/appSettings';

import { recordAdminAudit } from './audit';

const publicDbProcedure = publicProcedure.use(serverDatabase);

const maskApiKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (key.length <= 4) return '****';
  return `****${key.slice(-4)}`;
};

const SETTING_KEYS = APP_SETTING_KEYS;

const SENSITIVE_KEYS = new Set<string>([SETTING_KEYS.newapiApiKey, SETTING_KEYS.cronSecret]);

const BRAND_KEYS = [
  SETTING_KEYS.brandName,
  SETTING_KEYS.brandLogoUrl,
  SETTING_KEYS.brandFaviconUrl,
  SETTING_KEYS.brandPrimaryColor,
  SETTING_KEYS.brandSlogan,
] as const;

const readSetting = async (db: any, key: string): Promise<unknown> => {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return row?.value ?? null;
};

export const adminSettingsRouter = router({
  /**
   * Public read of brand-related settings, used by the SPA shell to render the
   * configured brand name / logo / theme color before user is authenticated.
   * Only non-sensitive keys are exposed.
   */
  getPublicBrand: publicDbProcedure.query(async ({ ctx }) => {
    const [name, logo, favicon, primary, slogan] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.brandName),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandFaviconUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandPrimaryColor),
      readSetting(ctx.serverDB, SETTING_KEYS.brandSlogan),
    ]);
    return {
      faviconUrl: typeof favicon === 'string' ? favicon : null,
      logoUrl: typeof logo === 'string' ? logo : null,
      name: typeof name === 'string' ? name : null,
      primaryColor: typeof primary === 'string' ? primary : null,
      slogan: typeof slogan === 'string' ? slogan : null,
    };
  }),

  getAll: adminProcedure.query(async ({ ctx }) => {
    const [
      apiKey,
      managedModels,
      proxyUrl,
      referralReward,
      cronSecret,
      auditDays,
      pendingDays,
      brandName,
      brandLogo,
      brandFavicon,
      brandPrimary,
      brandSlogan,
      defaultAgentModel,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.newapiApiKey),
      readSetting(ctx.serverDB, SETTING_KEYS.newapiEnabledModels),
      readSetting(ctx.serverDB, SETTING_KEYS.newapiProxyUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.referralRewardCredits),
      readSetting(ctx.serverDB, SETTING_KEYS.cronSecret),
      readSetting(ctx.serverDB, SETTING_KEYS.cronAuditRetentionDays),
      readSetting(ctx.serverDB, SETTING_KEYS.cronPendingOrderExpiryDays),
      readSetting(ctx.serverDB, SETTING_KEYS.brandName),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandFaviconUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandPrimaryColor),
      readSetting(ctx.serverDB, SETTING_KEYS.brandSlogan),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentModel),
    ]);

    const dbApiKey = typeof apiKey === 'string' ? apiKey : null;
    const managedModelIds = await getServerManagedNewApiModelIds(ctx.serverDB);
    const dbProxyUrl = proxyUrl;
    const dbCronSecret = typeof cronSecret === 'string' ? cronSecret : null;

    const resolvedDefaultAgentConfig = await getResolvedServerDefaultAgentConfig(ctx.serverDB);
    const currentDefaultModel =
      ((typeof defaultAgentModel === 'string' && defaultAgentModel.trim()) ||
        resolvedDefaultAgentConfig.model) as string | undefined;
    const defaultModelSuggestions = await getServerManagedDefaultModelSuggestions({
      currentModel: currentDefaultModel,
      db: ctx.serverDB,
    });

    return {
      brandFaviconUrl: typeof brandFavicon === 'string' ? brandFavicon : '',
      brandLogoUrl: typeof brandLogo === 'string' ? brandLogo : '',
      brandName: typeof brandName === 'string' ? brandName : '',
      brandPrimaryColor: typeof brandPrimary === 'string' ? brandPrimary : '',
      brandSlogan: typeof brandSlogan === 'string' ? brandSlogan : '',
      cronAuditRetentionDays: typeof auditDays === 'number' ? auditDays : 365,
      cronPendingOrderExpiryDays: typeof pendingDays === 'number' ? pendingDays : 7,
      cronSecretConfigured: Boolean(dbCronSecret ?? process.env.CRON_SECRET),
      cronSecretMasked: maskApiKey(dbCronSecret ?? process.env.CRON_SECRET),
      defaultAgentModel: currentDefaultModel || '',
      defaultModelSuggestions,
      newapiApiKeyMasked: maskApiKey(dbApiKey ?? process.env.NEWAPI_API_KEY),
      newapiEnabledModels:
        serializeModelIdList(managedModelIds) ?? serializeModelIdList(managedModels) ?? null,
      newapiProxyUrl:
        serializeUrlList(dbProxyUrl) ?? serializeUrlList(process.env.NEWAPI_PROXY_URL) ?? null,
      referralRewardCredits: typeof referralReward === 'number' ? referralReward : 0,
    };
  }),

  setAppSetting: adminProcedure
    .input(
      z.object({
        key: z.enum([
          SETTING_KEYS.newapiApiKey,
          SETTING_KEYS.newapiEnabledModels,
          SETTING_KEYS.newapiProxyUrl,
          SETTING_KEYS.defaultAgentModel,
          SETTING_KEYS.referralRewardCredits,
          SETTING_KEYS.cronSecret,
          SETTING_KEYS.cronAuditRetentionDays,
          SETTING_KEYS.cronPendingOrderExpiryDays,
          ...BRAND_KEYS,
        ]),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Coerce numeric keys to bounded integers to keep DB clean.
      let value: unknown = input.value;
      if (input.key === SETTING_KEYS.cronAuditRetentionDays) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('cronAuditRetentionDays must be a number');
        value = Math.max(7, Math.min(3650, Math.round(n)));
      } else if (input.key === SETTING_KEYS.cronPendingOrderExpiryDays) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('cronPendingOrderExpiryDays must be a number');
        value = Math.max(1, Math.min(365, Math.round(n)));
      } else if (input.key === SETTING_KEYS.referralRewardCredits) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('referralRewardCredits must be a number');
        value = Math.max(0, Math.round(n));
      } else if (input.key === SETTING_KEYS.newapiEnabledModels) {
        value = typeof value === 'string' ? value : serializeModelIdList(value) ?? '';
      } else if (input.key === SETTING_KEYS.newapiProxyUrl) {
        value = typeof value === 'string' ? value : serializeUrlList(value) ?? '';
      } else if (input.key === SETTING_KEYS.defaultAgentModel) {
        value = typeof value === 'string' ? value.trim() : '';
      }

      await ctx.serverDB
        .insert(appSettings)
        .values({ key: input.key, value: value as any })
        .onConflictDoUpdate({
          set: { updatedAt: new Date(), value: value as any },
          target: appSettings.key,
        });

      const isSensitive = SENSITIVE_KEYS.has(input.key);
      await recordAdminAudit(ctx, {
        action: 'settings.set',
        payload: {
          hasValue: value !== null && value !== undefined && value !== '',
          key: input.key,
          ...(isSensitive ? {} : { value }),
        },
        resourceId: input.key,
        resourceType: 'app_setting',
      });

      // Invalidate the in-memory brand cache so the next SSR pickup picks up
      // the change without waiting for the TTL to expire.
      if ((BRAND_KEYS as readonly string[]).includes(input.key)) {
        invalidateServerBrand();
      }

      invalidateServerAppSettings();

      return { ok: true };
    }),

  /**
   * Manually trigger maintenance job (audit pruning + pending order expiry).
   * Reuses the same DB-driven defaults as the public cron route.
   */
  runMaintenance: adminProcedure
    .input(
      z
        .object({
          auditRetentionDays: z.number().int().min(7).max(3650).optional(),
          pendingOrderExpiryDays: z.number().int().min(1).max(365).optional(),
          skipAudit: z.boolean().optional(),
          skipOrders: z.boolean().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const opts = input ?? {};
      const result: {
        auditCutoff?: string;
        auditLogsDeleted?: number;
        pendingOrdersCutoff?: string;
        pendingOrdersExpired?: number;
      } = {};

      if (!opts.skipAudit) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.cronAuditRetentionDays);
        const days = Math.max(
          7,
          Math.min(
            3650,
            opts.auditRetentionDays ?? (typeof dbVal === 'number' ? dbVal : 365),
          ),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const deleted = await ctx.serverDB
          .delete(adminAuditLogs)
          .where(lt(adminAuditLogs.createdAt, cutoff))
          .returning({ id: adminAuditLogs.id });
        result.auditCutoff = cutoff.toISOString();
        result.auditLogsDeleted = deleted.length;
      }

      if (!opts.skipOrders) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.cronPendingOrderExpiryDays);
        const days = Math.max(
          1,
          Math.min(
            365,
            opts.pendingOrderExpiryDays ?? (typeof dbVal === 'number' ? dbVal : 7),
          ),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const expired = await ctx.serverDB
          .update(topUpOrders)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(and(eq(topUpOrders.status, 'pending'), lt(topUpOrders.createdAt, cutoff)))
          .returning({ id: topUpOrders.id });
        result.pendingOrdersCutoff = cutoff.toISOString();
        result.pendingOrdersExpired = expired.length;
      }

      await recordAdminAudit(ctx, {
        action: 'maintenance.run',
        payload: result,
        resourceType: 'maintenance',
      });

      return { ok: true, ...result };
    }),
});
