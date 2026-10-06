import { CacheRevalidate, CacheTag } from '@lobechat/types';
import {
  type MarketSkillDetail,
  type MarketSkillListResponse,
  type MarketSkillListQuery,
  type MarketSkillDetailQuery,
} from '@lobehub/market-sdk';

import debug from 'debug';

const log = debug('lobe-server:market-skill-fallback');

export const MARKET_BASE_URL = process.env.MARKET_BASE_URL || 'https://market.lobehub.com';

const EMPTY_DESCRIPTION_FALLBACK = '内容暂不可用';

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

const isPlaceholderText = (text: string) => text.toUpperCase() === 'UN';

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (isPlaceholderText(text)) continue;
    if (text) return text;
  }
};

export const normalizeSkillListItem = (item: unknown, fallbackIdentifier?: unknown) => {
  if (!item || typeof item !== 'object') return;

  const skill = item as Record<string, unknown>;
  const identifier = firstText(skill.identifier, skill.slug, fallbackIdentifier);
  if (!identifier) return;

  const hasPlaceholderLabel = [skill.name, skill.title, skill.displayName].some(
    (value) => typeof value === 'string' && isPlaceholderText(value.trim()),
  );
  const hasDescriptionField = 'description' in skill || 'summary' in skill;
  const name = firstText(skill.name, skill.title, skill.displayName, identifier);
  const title = firstText(skill.title, skill.displayName);
  const description =
    firstText(skill.description, skill.summary) ||
    (hasDescriptionField || hasPlaceholderLabel ? EMPTY_DESCRIPTION_FALLBACK : undefined);
  const icon = firstText(skill.icon, skill.avatar);

  if (
    identifier === skill.identifier &&
    name === skill.name &&
    (title === undefined || title === skill.title) &&
    (description === undefined || description === skill.description) &&
    (icon === undefined || icon === skill.icon)
  ) {
    return item;
  }

  return {
    ...skill,
    ...(description ? { description } : {}),
    identifier,
    ...(icon ? { icon } : {}),
    name,
    ...(title ? { title } : {}),
  };
};

export const normalizeSkillListResponse = (
  response: MarketSkillListResponse,
): MarketSkillListResponse => {
  const items = Array.isArray(response.items) ? response.items : [];
  let changed = !Array.isArray(response.items);
  const normalizedItems: unknown[] = [];

  for (const item of items) {
    const normalized = normalizeSkillListItem(item);
    if (!normalized) {
      changed = true;
      continue;
    }

    normalizedItems.push(normalized);
    if (normalized !== item) changed = true;
  }

  return changed ? ({ ...response, items: normalizedItems } as MarketSkillListResponse) : response;
};

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
