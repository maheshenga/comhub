import { and, asc, eq } from 'drizzle-orm';

import { isModelAllowedByPlanRules, resolvePlanModelRules } from '@/business/server/planModelRules';
import { adminNewapiInstanceModels, adminNewapiInstances } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';

export type NewapiModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

export interface ResolvedNewapiInstance {
  apiKey: string;
  baseUrl: string;
  groupKey: string;
  groupMultiplier?: number | null;
  groupName?: string | null;
  instanceId: string;
  instanceName: string;
  priority: number;
  source: 'instance';
}

const TTL_MS = 30_000;
let cache: { at: number; rows: InstanceRowCache[] } | null = null;

interface InstanceRowCache {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  groupKey: string;
  groupMultiplier?: number | null;
  groupName?: string | null;
  id: string;
  name: string;
  priority: number;
  usageScope?: NewapiModelType[] | null;
}

const readEnabledInstances = async (db: LobeChatDatabase): Promise<InstanceRowCache[]> => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  try {
    const rows = await db
      .select({
        apiKey: adminNewapiInstances.apiKey,
        baseUrl: adminNewapiInstances.baseUrl,
        enabled: adminNewapiInstances.enabled,
        groupKey: adminNewapiInstances.groupKey,
        groupMultiplier: adminNewapiInstances.groupMultiplier,
        groupName: adminNewapiInstances.groupName,
        id: adminNewapiInstances.id,
        name: adminNewapiInstances.name,
        priority: adminNewapiInstances.priority,
        usageScope: adminNewapiInstances.usageScope,
      })
      .from(adminNewapiInstances)
      .where(eq(adminNewapiInstances.enabled, true))
      .orderBy(asc(adminNewapiInstances.priority));
    cache = { at: Date.now(), rows };
    return rows;
  } catch {
    cache = { at: Date.now(), rows: [] };
    return [];
  }
};

export const invalidateNewapiInstancesCache = () => {
  cache = null;
};

interface ResolveNewapiInstancesParams {
  modelId?: string | null;
  modelType?: NewapiModelType;
  preferredGroupKey?: string | null;
  userId?: string;
}

interface NewapiRouteRow {
  apiKey: string;
  baseUrl: string;
  groupKey?: string | null;
  groupMultiplier?: number | null;
  groupName?: string | null;
  id: string;
  name: string;
  priority: number;
  usageScope?: NewapiModelType[] | null;
}

const toResolvedInstance = (row: NewapiRouteRow): ResolvedNewapiInstance => ({
  apiKey: row.apiKey,
  baseUrl: row.baseUrl,
  groupKey: row.groupKey || 'default',
  groupMultiplier: row.groupMultiplier,
  groupName: row.groupName,
  instanceId: row.id,
  instanceName: row.name,
  priority: row.priority,
  source: 'instance',
});

const usageScopeAllows = (
  usageScope: NewapiModelType[] | null | undefined,
  modelType: NewapiModelType,
) => !Array.isArray(usageScope) || usageScope.length === 0 || usageScope.includes(modelType);

/**
 * Resolve the NewAPI instances that can serve a given model.
 *
 * Selection order: enabled instance(s) that have the (modelId, modelType)
 * registered and enabled, sorted by ascending priority (lower wins) for failover.
 */
export const resolveNewapiInstancesForModel = async (
  db: LobeChatDatabase,
  modelIdOrParams: string | undefined | null | ResolveNewapiInstancesParams,
  legacyModelType: NewapiModelType = 'chat',
): Promise<ResolvedNewapiInstance[]> => {
  const params =
    typeof modelIdOrParams === 'object' && modelIdOrParams !== null
      ? modelIdOrParams
      : { modelId: modelIdOrParams, modelType: legacyModelType };
  const modelType = params.modelType ?? 'chat';
  const preferredGroupKey = params.preferredGroupKey?.trim();
  const trimmedModel = params.modelId?.trim();

  if (trimmedModel) {
    const rows: NewapiRouteRow[] = await db
      .select({
        apiKey: adminNewapiInstances.apiKey,
        baseUrl: adminNewapiInstances.baseUrl,
        groupKey: adminNewapiInstances.groupKey,
        groupMultiplier: adminNewapiInstances.groupMultiplier,
        groupName: adminNewapiInstances.groupName,
        id: adminNewapiInstances.id,
        name: adminNewapiInstances.name,
        priority: adminNewapiInstances.priority,
        usageScope: adminNewapiInstances.usageScope,
      })
      .from(adminNewapiInstanceModels)
      .innerJoin(
        adminNewapiInstances,
        eq(adminNewapiInstanceModels.instanceId, adminNewapiInstances.id),
      )
      .where(
        and(
          eq(adminNewapiInstances.enabled, true),
          eq(adminNewapiInstanceModels.enabled, true),
          eq(adminNewapiInstanceModels.modelId, trimmedModel),
          eq(adminNewapiInstanceModels.modelType, modelType),
        ),
      )
      .orderBy(asc(adminNewapiInstances.priority));

    if (rows.length > 0) {
      const rules = params.userId
        ? await resolvePlanModelRules({ db, userId: params.userId })
        : null;

      const allowedRows = rows.filter((row) => {
        const groupKey = row.groupKey || 'default';
        if (preferredGroupKey && groupKey !== preferredGroupKey) return false;
        if (!usageScopeAllows(row.usageScope, modelType)) return false;

        return isModelAllowedByPlanRules(rules, trimmedModel, modelType, groupKey);
      });

      const selectedGroupKey = preferredGroupKey || allowedRows[0]?.groupKey || 'default';
      return allowedRows
        .filter((row) => (row.groupKey || 'default') === selectedGroupKey)
        .map(toResolvedInstance);
    }
  }

  return [];
};

/**
 * Pick the highest-priority enabled instance, ignoring per-model registration.
 * Used when the call has no specific model (e.g. listing models, pulling models).
 */
export const resolveDefaultNewapiInstance = async (
  db: LobeChatDatabase,
): Promise<ResolvedNewapiInstance | null> => {
  const rows = await readEnabledInstances(db);
  if (rows.length > 0) {
    const r = rows.find((row) => (row.groupKey || 'default') === 'default') ?? rows[0];
    return toResolvedInstance(r);
  }

  return null;
};

export interface EnabledModelEntry {
  displayName: string | null;
  id: string;
  type: NewapiModelType;
}

/**
 * Read all enabled models across all enabled instances with their types and
 * display names. Used by globalConfig to inject the full model list (all 8
 * types) into the frontend.
 */
export const getAllEnabledModels = async (db?: LobeChatDatabase): Promise<EnabledModelEntry[]> => {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        modelId: adminNewapiInstanceModels.modelId,
        modelType: adminNewapiInstanceModels.modelType,
        displayName: adminNewapiInstanceModels.displayName,
      })
      .from(adminNewapiInstanceModels)
      .innerJoin(
        adminNewapiInstances,
        eq(adminNewapiInstanceModels.instanceId, adminNewapiInstances.id),
      )
      .where(
        and(eq(adminNewapiInstances.enabled, true), eq(adminNewapiInstanceModels.enabled, true)),
      )
      .orderBy(asc(adminNewapiInstanceModels.sortOrder));

    const seen = new Set<string>();
    const result: EnabledModelEntry[] = [];
    for (const row of rows) {
      const key = `${row.modelId}:${row.modelType}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          displayName: row.displayName,
          id: row.modelId,
          type: row.modelType as NewapiModelType,
        });
      }
    }
    return result;
  } catch {
    return [];
  }
};
