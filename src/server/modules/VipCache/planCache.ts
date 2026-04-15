import { PlanModel } from '@/database/models/plan';
import type { LobeChatDatabase } from '@/database/type';
import type { PlanItem } from '@/database/schemas';

let _cachedPlans: PlanItem[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 300_000; // 5 minutes

/**
 * Get enabled plans with TTL cache.
 * Plans rarely change, so a 5-minute cache avoids redundant DB queries.
 */
export const getCachedEnabledPlans = async (db: LobeChatDatabase): Promise<PlanItem[]> => {
  const now = Date.now();
  if (_cachedPlans && now - _cacheTimestamp < CACHE_TTL_MS) return _cachedPlans;

  const model = new PlanModel(db);
  _cachedPlans = await model.getEnabled();
  _cacheTimestamp = now;
  return _cachedPlans;
};

/**
 * Invalidate the plans cache (call after admin creates/updates/deletes a plan).
 */
export const invalidatePlansCache = () => {
  _cachedPlans = null;
  _cacheTimestamp = 0;
};
