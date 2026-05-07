import { and, asc, eq } from 'drizzle-orm';

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
  id: string;
  name: string;
  priority: number;
}

const readEnabledInstances = async (db: LobeChatDatabase): Promise<InstanceRowCache[]> => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  try {
    const rows = await db
      .select({
        apiKey: adminNewapiInstances.apiKey,
        baseUrl: adminNewapiInstances.baseUrl,
        enabled: adminNewapiInstances.enabled,
        id: adminNewapiInstances.id,
        name: adminNewapiInstances.name,
        priority: adminNewapiInstances.priority,
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

/**
 * Resolve the NewAPI instances that can serve a given model.
 *
 * Selection order: enabled instance(s) that have the (modelId, modelType)
 * registered and enabled, sorted by ascending priority (lower wins) for failover.
 */
export const resolveNewapiInstancesForModel = async (
  db: LobeChatDatabase,
  modelId: string | undefined | null,
  modelType: NewapiModelType = 'chat',
): Promise<ResolvedNewapiInstance[]> => {
  const trimmedModel = modelId?.trim();

  if (trimmedModel) {
    const rows = await db
      .select({
        apiKey: adminNewapiInstances.apiKey,
        baseUrl: adminNewapiInstances.baseUrl,
        id: adminNewapiInstances.id,
        name: adminNewapiInstances.name,
        priority: adminNewapiInstances.priority,
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
      return rows.map((r) => ({
        apiKey: r.apiKey,
        baseUrl: r.baseUrl,
        instanceId: r.id,
        instanceName: r.name,
        priority: r.priority,
        source: 'instance' as const,
      }));
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
    const r = rows[0];
    return {
      apiKey: r.apiKey,
      baseUrl: r.baseUrl,
      instanceId: r.id,
      instanceName: r.name,
      priority: r.priority,
      source: 'instance',
    };
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
