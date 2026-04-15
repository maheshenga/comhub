import { getAppConfig } from '@/envs/app';
import { UserSubscriptionModel } from '@/database/models/userSubscription';
import { type LobeChatDatabase } from '@/database/type';

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
 * Check if the platform NewAPI gateway is configured.
 */
export const isPlatformGatewayEnabled = (): boolean => {
  const config = getAppConfig();
  return !!(config.PLATFORM_NEWAPI_BASE_URL && config.PLATFORM_NEWAPI_API_KEY);
};

/**
 * Get platform gateway credentials.
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
 * Returns PlatformCredentials if:
 * 1. The platform gateway is configured (env vars set)
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

  // Check if platform gateway is configured
  const credentials = getPlatformCredentials();
  if (!credentials) return null;

  // Check if user has active VIP subscription
  const subscriptionModel = new UserSubscriptionModel(db);
  const isVip = await subscriptionModel.hasActiveSubscription(userId);
  if (!isVip) return null;

  return credentials;
};
