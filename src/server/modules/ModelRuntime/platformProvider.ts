import { SiteConfigModel } from '@/database/models/siteConfig';
import { UserSubscriptionModel } from '@/database/models/userSubscription';
import { type LobeChatDatabase } from '@/database/type';
import { getAppConfig } from '@/envs/app';

/**
 * Platform provider credentials returned when a VIP user
 * doesn't have their own API key for the requested provider.
 *
 * All requests go through the NewAPI gateway which is OpenAI-compatible
 * and supports routing to multiple upstream providers (OpenAI, Claude,
 * DeepSeek, Gemini, etc.) based on the model name.
 */
export interface PlatformCredentials {
  apiKey: string;
  baseURL: string;
}

/**
 * In-memory TTL cache for gateway config from site_config DB.
 * Avoids hitting DB on every LLM request.
 */
let _gwCache: { apiKey: string | null; baseURL: string | null; modelPricing: string | null } | null = null;
let _gwCacheTs = 0;
const GW_CACHE_TTL = 60_000; // 60 seconds

/**
 * Read gateway config from site_config table with TTL cache.
 * Returns { baseURL, apiKey, modelPricing } or null values for unconfigured keys.
 */
export const getGatewayConfigFromDB = async (
  db: LobeChatDatabase,
): Promise<{ apiKey: string | null; baseURL: string | null; modelPricing: string | null }> => {
  const now = Date.now();
  if (_gwCache && now - _gwCacheTs < GW_CACHE_TTL) return _gwCache;

  try {
    const model = new SiteConfigModel(db);
    const [baseURL, apiKey, modelPricing] = await Promise.all([
      model.getValue('platform_newapi_base_url'),
      model.getValue('platform_newapi_api_key'),
      model.getValue('platform_newapi_model_pricing'),
    ]);
    _gwCache = { apiKey, baseURL, modelPricing };
    _gwCacheTs = now;
    return _gwCache;
  } catch {
    // Table might not exist yet — return empty
    return { apiKey: null, baseURL: null, modelPricing: null };
  }
};

/**
 * Invalidate the gateway config cache (call after admin saves).
 */
export const invalidateGatewayConfigCache = () => {
  _gwCache = null;
  _gwCacheTs = 0;
};

/**
 * Check if the platform NewAPI gateway is configured (env-var only, sync).
 */
export const isPlatformGatewayEnabled = (): boolean => {
  const config = getAppConfig();
  return !!(config.PLATFORM_NEWAPI_BASE_URL && config.PLATFORM_NEWAPI_API_KEY);
};

/**
 * Get platform gateway credentials (env-var only, sync).
 * Returns null if not configured.
 */
export const getPlatformCredentials = (): PlatformCredentials | null => {
  const config = getAppConfig();
  if (!config.PLATFORM_NEWAPI_BASE_URL || !config.PLATFORM_NEWAPI_API_KEY) return null;
  return {
    apiKey: config.PLATFORM_NEWAPI_API_KEY,
    baseURL: config.PLATFORM_NEWAPI_BASE_URL,
  };
};

/**
 * Resolve platform credentials for a VIP user.
 *
 * Priority: site_config DB > environment variables.
 *
 * Returns PlatformCredentials if:
 * 1. The platform gateway is configured (DB or env vars)
 * 2. The user has an active VIP subscription
 * 3. The user does NOT have their own API key for this provider
 *
 * Returns null otherwise — the normal flow continues.
 */
export const resolvePlatformCredentials = async (
  db: LobeChatDatabase,
  userId: string,
  userHasOwnApiKey: boolean,
): Promise<PlatformCredentials | null> => {
  // If user has their own key, never override
  if (userHasOwnApiKey) return null;

  // Try DB first, then fall back to env vars
  const dbConfig = await getGatewayConfigFromDB(db);
  const baseURL = dbConfig.baseURL || getAppConfig().PLATFORM_NEWAPI_BASE_URL;
  const apiKey = dbConfig.apiKey || getAppConfig().PLATFORM_NEWAPI_API_KEY;

  if (!baseURL || !apiKey) return null;

  // Check if user has active VIP subscription
  const subscriptionModel = new UserSubscriptionModel(db);
  const isVip = await subscriptionModel.hasActiveSubscription(userId);
  if (!isVip) return null;

  return { apiKey, baseURL };
};
