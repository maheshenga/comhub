import { CacheRevalidate, CacheTag } from '@lobechat/types';
import {
  type MarketSkillDetail,
  type MarketSkillListResponse,
  type MarketSkillListQuery,
  type MarketSkillDetailQuery,
} from '@lobehub/market-sdk';

import debug from 'debug';

import {
  normalizeCatalogItem,
  normalizeCatalogListResponse,
} from '@/server/services/placeholderNormalization';

const log = debug('lobe-server:market-skill-fallback');

export const MARKET_BASE_URL = process.env.MARKET_BASE_URL || 'https://market.lobehub.com';

const MARKET_SKILL_AUTH_ERROR_CODES = new Set(['invalid_token', 'unauthorized']);

export const isMarketAuthError = (error: unknown) => {
  const err = error as {
    code?: string;
    errorBody?: { error?: { code?: string } | string };
    status?: number;
  };
  const bodyError = err.errorBody?.error;
  const bodyCode = typeof bodyError === 'string' ? bodyError : bodyError?.code;

  return err.status === 401 || MARKET_SKILL_AUTH_ERROR_CODES.has(err.code || bodyCode || '');
};

const appendDefinedSearchParams = (url: URL, params: object) => {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
};

const fetchPublicMarketJson = async <T>(path: string, params: object = {}) => {
  const url = new URL(path, MARKET_BASE_URL);
  appendDefinedSearchParams(url, params);

  const response = await fetch(url.toString(), { method: 'GET' });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Market public endpoint failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
};

export const normalizeSkillListItem = (item: unknown, fallbackIdentifier?: unknown) =>
  normalizeCatalogItem(item, { fallbackIdentifier });

export const normalizeSkillListResponse = (response: MarketSkillListResponse) =>
  normalizeCatalogListResponse(response, (item) => normalizeSkillListItem(item));

/**
 * Search skill catalogue with a public-endpoint fallback: when the SDK call
 * fails on Market auth (stale M2M credential, throttled token), re-issue the
 * same query against the unauthenticated sitemap endpoint and normalize it.
 *
 * The SDK call is cached the same way every other discover list is cached
 * (see DiscoverService.getMcpList). Without this the skill store was the one
 * browse surface that hit Market on every open and every page, which is why
 * it — alone among the store's tabs — went down whenever the upstream was
 * throttled or a credential went stale. The MCP tab looked healthy through
 * the same incidents only because it was being served from this cache.
 */
export const searchSkillWithFallback = async (
  getSkillList: (
    params?: MarketSkillListQuery,
    options?: RequestInit,
  ) => Promise<MarketSkillListResponse>,
  params: MarketSkillListQuery,
): Promise<MarketSkillListResponse> => {
  try {
    const result = await getSkillList(params, {
      next: {
        revalidate: CacheRevalidate.List,
        tags: [CacheTag.Discover, CacheTag.Skills],
      },
    });

    log('searchSkill response: %O', result);

    return normalizeSkillListResponse(result);
  } catch (error) {
    if (!isMarketAuthError(error)) throw error;

    log('searchSkill SDK auth failed, falling back to public sitemap: %O', error);

    const result = await fetchPublicMarketJson<MarketSkillListResponse>(
      '/api/v1/skills/sitemap',
      params,
    );
    return normalizeSkillListResponse(result);
  }
};

/**
 * Get skill detail with a public-endpoint fallback for Market auth errors,
 * mirroring {@link searchSkillWithFallback}.
 */
export const getSkillDetailWithFallback = async (
  getSkillDetail: (
    identifier: string,
    params?: MarketSkillDetailQuery,
  ) => Promise<MarketSkillDetail>,
  identifier: string,
  options?: { locale?: string; version?: string },
): Promise<MarketSkillDetail> => {
  try {
    const result = await getSkillDetail(identifier, options);

    log('getSkillDetail response: %O', result);

    return (normalizeSkillListItem(result, identifier) || result) as MarketSkillDetail;
  } catch (error) {
    if (!isMarketAuthError(error)) throw error;

    log('getSkillDetail SDK auth failed, falling back to public detail: %O', error);

    const result = await fetchPublicMarketJson<MarketSkillDetail>(
      `/api/v1/skills/${encodeURIComponent(identifier)}`,
      options,
    );

    return (normalizeSkillListItem(result, identifier) || result) as MarketSkillDetail;
  }
};
