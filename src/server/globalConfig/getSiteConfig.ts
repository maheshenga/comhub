import { cache } from 'react';

import { getServerDB } from '@/database/core/db-adaptor';
import { SiteConfigModel } from '@/database/models/siteConfig';

/**
 * In-memory TTL cache for site config.
 * Site config changes extremely rarely (only admin updates), so a short TTL
 * eliminates nearly all DB queries while keeping data fresh.
 */
let _cachedConfig: Record<string, string | null> | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

const fetchSiteConfig = async (): Promise<Record<string, string | null>> => {
  const now = Date.now();
  if (_cachedConfig && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedConfig;
  }

  try {
    const db = await getServerDB();
    const model = new SiteConfigModel(db);
    _cachedConfig = await model.getPublicMap();
    _cacheTimestamp = now;
    return _cachedConfig;
  } catch {
    // If the table doesn't exist yet (migration not run), return empty
    return _cachedConfig || {};
  }
};

/**
 * Load public (non-encrypted) site config from the database.
 * Returns a flat key-value map like { brand_name: 'MyBrand', site_title: 'MyApp', ... }
 *
 * Uses two layers of caching:
 * 1. React cache() — deduplicates calls within a single server request/render
 * 2. In-memory TTL cache (60s) — avoids DB queries across requests
 */
export const getPublicSiteConfig = cache(fetchSiteConfig);

/**
 * Invalidate the in-memory site config cache.
 * Call this after an admin updates site config.
 */
export const invalidateSiteConfigCache = () => {
  _cachedConfig = null;
  _cacheTimestamp = 0;
};
