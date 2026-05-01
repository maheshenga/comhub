import type { LobeAgentConfig } from '@lobechat/types';
import { eq, inArray } from 'drizzle-orm';
import { type PartialDeep } from 'type-fest';

import { appSettings } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { type LobeChatDatabase } from '@/database/type';

export const APP_SETTING_KEYS = {
  brandFaviconUrl: 'brand.faviconUrl',
  brandLogoUrl: 'brand.logoUrl',
  brandName: 'brand.name',
  brandPrimaryColor: 'brand.primaryColor',
  brandSlogan: 'brand.slogan',
  cronAuditRetentionDays: 'cron.auditRetentionDays',
  cronPendingOrderExpiryDays: 'cron.pendingOrderExpiryDays',
  cronSecret: 'cron.secret',
  defaultAgentModel: 'defaultAgent.model',
  newapiApiKey: 'newapi.apiKey',
  newapiEnabledModels: 'newapi.enabledModels',
  newapiProxyUrl: 'newapi.proxyUrl',
  referralRewardCredits: 'referral.rewardCredits',
} as const;

const CACHED_KEYS = [
  APP_SETTING_KEYS.defaultAgentModel,
  APP_SETTING_KEYS.newapiApiKey,
  APP_SETTING_KEYS.newapiEnabledModels,
  APP_SETTING_KEYS.newapiProxyUrl,
] as const;

const TTL_MS = 30_000;

let cachedSettings: { at: number; data: Record<string, unknown> } | null = null;

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeUrlList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(/[\r\n,;；，]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\r\n,;；，]+/)
      : [];

  return Array.from(
    new Set(
      rawValues
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/\/+$/, '')),
    ),
  );
};

export const serializeUrlList = (value: unknown) => {
  const urls = normalizeUrlList(value);

  return urls.length > 0 ? urls.join('\n') : null;
};

export const normalizeModelIdList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(/[\r\n,;；，]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\r\n,;；，]+/)
      : [];

  return Array.from(new Set(rawValues.map((item) => item.trim()).filter(Boolean)));
};

export const serializeModelIdList = (value: unknown) => {
  const modelIds = normalizeModelIdList(value);

  return modelIds.length > 0 ? modelIds.join('\n') : null;
};

const readCachedSettings = async (db?: LobeChatDatabase): Promise<Record<string, unknown>> => {
  if (cachedSettings && Date.now() - cachedSettings.at < TTL_MS) return cachedSettings.data;

  try {
    const serverDB = db ?? (await getServerDB());
    const rows = await serverDB.query.appSettings.findMany({
      where: inArray(appSettings.key, [...CACHED_KEYS]),
    });

    const data = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    cachedSettings = { at: Date.now(), data };

    return data;
  } catch {
    const data: Record<string, unknown> = {};
    cachedSettings = { at: Date.now(), data };

    return data;
  }
};

export const getAppSettingValue = async (key: string, db?: LobeChatDatabase): Promise<unknown> => {
  if ((CACHED_KEYS as readonly string[]).includes(key)) {
    const cached = await readCachedSettings(db);
    return cached[key] ?? null;
  }

  try {
    const serverDB = db ?? (await getServerDB());
    const row = await serverDB.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
    return row?.value ?? null;
  } catch {
    return null;
  }
};

export const getServerDefaultAgentSettingOverrides = async (
  db?: LobeChatDatabase,
): Promise<PartialDeep<LobeAgentConfig>> => {
  const rawModel = await getAppSettingValue(APP_SETTING_KEYS.defaultAgentModel, db);
  const model = normalizeString(rawModel);

  return model ? { model } : {};
};

export const getServerManagedNewApiConfig = async (db?: LobeChatDatabase) => {
  const [rawApiKey, rawProxyUrl] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.newapiApiKey, db),
    getAppSettingValue(APP_SETTING_KEYS.newapiProxyUrl, db),
  ]);

  const proxyUrls = normalizeUrlList(rawProxyUrl);

  return {
    apiKey: normalizeString(rawApiKey),
    proxyUrlText: proxyUrls.length > 0 ? proxyUrls.join('\n') : null,
    proxyUrls,
  };
};

export const getServerManagedNewApiModelIds = async (db?: LobeChatDatabase) => {
  const rawModelIds = await getAppSettingValue(APP_SETTING_KEYS.newapiEnabledModels, db);

  return normalizeModelIdList(rawModelIds);
};

export const getServerManagedDefaultModelSuggestions = async ({
  currentModel,
  db,
}: {
  currentModel?: string | null;
  db?: LobeChatDatabase;
}) => {
  const managedModels = await getServerManagedNewApiModelIds(db);

  return Array.from(
    new Set(
      [
        currentModel?.trim(),
        ...managedModels,
      ].filter(Boolean) as string[],
    ),
  );
};

export const invalidateServerAppSettings = () => {
  cachedSettings = null;
};
