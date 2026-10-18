import { eq } from 'drizzle-orm';
import { type AiModelReasoningConfig } from 'model-bank';

import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';
import { appSettings } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';

import { type ModelDefaultsConfig, normalizeModelDefaultsConfig } from './normalize';

export {
  EMPTY_MODEL_DEFAULTS_CONFIG,
  MODEL_DEFAULTS_MAX_ENTRIES,
  type ModelContextWindowDefault,
  type ModelDefaultsConfig,
  modelDefaultsConfigSchema,
  type ModelReasoningDefault,
  normalizeModelDefaultsConfig,
} from './normalize';

export const ADMIN_MODEL_DEFAULTS_SETTING_KEY = APP_SETTING_KEYS.modelDefaults;

export const modelDefaultsKey = (providerId: string, modelId: string) => `${providerId}/${modelId}`;

export interface ResolvedModelDefaults {
  /** `${providerId}/${modelId}` -> context window tokens (0 = unlimited). */
  contextWindow: ReadonlyMap<string, number>;
  raw: ModelDefaultsConfig;
  reasoning: ReadonlyMap<string, AiModelReasoningConfig>;
  reasoningRecord: Record<string, AiModelReasoningConfig>;
}

const CACHE_TTL_MS = 30_000;

let cachedDefaults: { at: number; value: ResolvedModelDefaults } | null = null;

const resolveModelDefaults = (raw: ModelDefaultsConfig): ResolvedModelDefaults => {
  const contextWindow = new Map<string, number>();
  const reasoning = new Map<string, AiModelReasoningConfig>();

  for (const entry of raw.contextWindow) {
    contextWindow.set(modelDefaultsKey(entry.providerId, entry.modelId), entry.tokens);
  }

  for (const entry of raw.reasoning) {
    reasoning.set(modelDefaultsKey(entry.providerId, entry.modelId), entry.config);
  }

  return {
    contextWindow,
    raw,
    reasoning,
    reasoningRecord: Object.fromEntries(reasoning),
  };
};

const EMPTY_RESOLVED_MODEL_DEFAULTS = resolveModelDefaults({ contextWindow: [], reasoning: [] });

export const clearAdminModelDefaultsCache = () => {
  cachedDefaults = null;
};

/**
 * Reads the admin model defaults with a module-level 30s TTL cache. A read
 * failure degrades to "no defaults" so model listing/auth keeps working.
 */
export const loadAdminModelDefaults = async (
  db: LobeChatDatabase,
): Promise<ResolvedModelDefaults> => {
  const now = Date.now();
  if (cachedDefaults && now - cachedDefaults.at < CACHE_TTL_MS) return cachedDefaults.value;

  let storedValue: unknown;

  try {
    const row = await db.query.appSettings.findFirst({
      columns: { value: true },
      where: eq(appSettings.key, ADMIN_MODEL_DEFAULTS_SETTING_KEY),
    });
    storedValue = row?.value;
  } catch {
    return EMPTY_RESOLVED_MODEL_DEFAULTS;
  }

  const value = resolveModelDefaults(normalizeModelDefaultsConfig(storedValue));
  cachedDefaults = { at: now, value };

  return value;
};
