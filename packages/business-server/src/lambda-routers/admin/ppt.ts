import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import { appSettings } from '@/database/schemas';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import { APP_SETTING_KEYS, invalidateServerAppSettings } from '@/server/services/appSettings';
import { normalizeDocmeePptSettings } from '@/server/services/docmee/config';

import { recordAdminAudit } from './audit';

const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);
const systemWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemWrite);

const PPT_SETTING_KEYS = [
  APP_SETTING_KEYS.docmeePptAllowPdfExport,
  APP_SETTING_KEYS.docmeePptAllowPptxDownload,
  APP_SETTING_KEYS.docmeePptApiKey,
  APP_SETTING_KEYS.docmeePptAuditEnabled,
  APP_SETTING_KEYS.docmeePptBaseUrl,
  APP_SETTING_KEYS.docmeePptCreatorVersion,
  APP_SETTING_KEYS.docmeePptDailyLimit,
  APP_SETTING_KEYS.docmeePptDefaultLang,
  APP_SETTING_KEYS.docmeePptEnabled,
  APP_SETTING_KEYS.docmeePptThemeColor,
  APP_SETTING_KEYS.docmeePptTokenTtlMinutes,
] as const;

const maskApiKey = (key: null | string | undefined): null | string => {
  if (!key) return null;
  if (key.length <= 4) return '****';

  return `****${key.slice(-4)}`;
};

const readSettings = async (db: any) => {
  const rows = await db.query.appSettings.findMany({
    where: inArray(appSettings.key, [...PPT_SETTING_KEYS]),
  });

  return Object.fromEntries(rows.map((row: any) => [row.key, row.value]));
};

const saveSetting = async (db: any, key: string, value: unknown) => {
  await db
    .insert(appSettings)
    .values({ key, value: value as any })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value: value as any },
      target: appSettings.key,
    });
};

const inputSchema = z.object({
  allowPdfExport: z.boolean().optional(),
  allowPptxDownload: z.boolean().optional(),
  apiKey: z.string().optional(),
  auditEnabled: z.boolean().optional(),
  baseUrl: z.string().trim().min(1).max(512).optional(),
  clearApiKey: z.boolean().optional(),
  creatorVersion: z.enum(['v1', 'v2']).optional(),
  dailyLimit: z.number().int().min(0).nullable().optional(),
  enabled: z.boolean().optional(),
  lang: z.string().trim().min(1).max(16).optional(),
  themeColor: z.string().trim().max(32).nullable().optional(),
  tokenTtlMinutes: z.number().int().min(1).max(1440).optional(),
});

export const adminPptRouter = router({
  getSettings: systemReadProcedure.query(async ({ ctx }) => {
    const raw = await readSettings(ctx.serverDB);
    const settings = normalizeDocmeePptSettings(raw);

    return {
      ...settings,
      apiKey: '',
      apiKeyConfigured: Boolean(settings.apiKey),
      apiKeyMasked: maskApiKey(settings.apiKey),
    };
  }),

  saveSettings: systemWriteProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
    const raw = await readSettings(ctx.serverDB);
    const previous = normalizeDocmeePptSettings(raw);
    const next = {
      ...previous,
      ...('allowPdfExport' in input ? { allowPdfExport: input.allowPdfExport } : {}),
      ...('allowPptxDownload' in input ? { allowPptxDownload: input.allowPptxDownload } : {}),
      ...('auditEnabled' in input ? { auditEnabled: input.auditEnabled } : {}),
      ...('baseUrl' in input ? { baseUrl: input.baseUrl } : {}),
      ...('creatorVersion' in input ? { creatorVersion: input.creatorVersion } : {}),
      ...('dailyLimit' in input
        ? { dailyLimit: input.dailyLimit && input.dailyLimit > 0 ? input.dailyLimit : null }
        : {}),
      ...('enabled' in input ? { enabled: input.enabled } : {}),
      ...('lang' in input ? { lang: input.lang } : {}),
      ...('themeColor' in input ? { themeColor: input.themeColor || null } : {}),
      ...('tokenTtlMinutes' in input ? { tokenTtlMinutes: input.tokenTtlMinutes } : {}),
    };
    const trimmedApiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
    const apiKey = input.clearApiKey ? null : trimmedApiKey || previous.apiKey;

    await Promise.all([
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptAllowPdfExport, next.allowPdfExport),
      saveSetting(
        ctx.serverDB,
        APP_SETTING_KEYS.docmeePptAllowPptxDownload,
        next.allowPptxDownload,
      ),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptAuditEnabled, next.auditEnabled),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptBaseUrl, next.baseUrl),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptCreatorVersion, next.creatorVersion),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptDailyLimit, next.dailyLimit),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptDefaultLang, next.lang),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptEnabled, next.enabled),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptThemeColor, next.themeColor),
      saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptTokenTtlMinutes, next.tokenTtlMinutes),
      ...(input.clearApiKey || trimmedApiKey
        ? [saveSetting(ctx.serverDB, APP_SETTING_KEYS.docmeePptApiKey, apiKey)]
        : []),
    ]);

    await recordAdminAudit(ctx, {
      action: 'ppt.settings.save',
      payload: {
        apiKeyChanged: input.clearApiKey || Boolean(trimmedApiKey),
        enabled: next.enabled,
      },
      resourceType: 'app_setting',
    });

    invalidateServerAppSettings();

    return { ok: true };
  }),
});
