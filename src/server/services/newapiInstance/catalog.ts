import urlJoin from 'url-join';

import type { NewapiModelType } from './index';

export type AdminModelApiProviderType =
  | 'newapi'
  | 'openai-compatible'
  | 'openai'
  | 'claude'
  | 'deepseek'
  | 'aliyun'
  | 'opencode-go'
  | 'siliconflow';

export interface NewapiRemoteModel {
  created?: number;
  id: string;
  object?: string;
  owned_by?: string;
  supported_endpoint_types?: string[];
  type?: string;
}

export interface NewapiRemotePricing {
  completion_ratio?: number;
  description?: string;
  enable_groups?: string[];
  model_name: string;
  model_price?: number;
  model_ratio?: number;
  quota_type?: number;
  supported_endpoint_types?: string[];
}

export interface ExistingNewapiModelRow {
  displayName?: string | null;
  enabled: boolean;
  metadata?: Record<string, unknown> | null;
  modelId: string;
  modelType: string;
  sortOrder?: number;
}

export interface NormalizedNewapiSyncRow {
  displayName?: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  modelId: string;
  modelType: NewapiModelType;
  sortOrder: number;
}

export type NewapiPricingSyncStatus = 'available' | 'unavailable' | 'unsupported';

export interface NewapiPricingFetchResult {
  items: NewapiRemotePricing[];
  status: NewapiPricingSyncStatus;
}

const DEFAULT_CATALOG_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024;

const endpointIncludes = (values: string[], terms: string[]) =>
  values.some((value) => terms.some((term) => value.includes(term)));

const idIncludes = (id: string, terms: string[]) => terms.some((term) => id.includes(term));

const normalizeNewapiRoot = (baseUrl: string) =>
  baseUrl.replace(/\/+$/, '').replace(/\/v\d+[a-z]*\/?$/, '');

const normalizeNewapiApiBase = (baseUrl: string) => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return /\/v\d+[a-z]*$/i.test(trimmed) ? trimmed : urlJoin(trimmed, '/v1');
};

export const supportsNewapiPricingSync = (
  providerType?: AdminModelApiProviderType | string | null,
) => !providerType || providerType === 'newapi';

export const buildNewapiPricingSyncWarnings = (
  providerType: AdminModelApiProviderType | string | null | undefined,
  pricingCount: number,
  status: NewapiPricingSyncStatus = 'available',
) => {
  if (!supportsNewapiPricingSync(providerType)) {
    return [
      `Pricing sync is not supported for provider type ${providerType}. Configure manual pricing in the model billing matrix.`,
    ];
  }

  if (status === 'unavailable') {
    return ['Pricing endpoint unavailable; existing pricing metadata was preserved'];
  }

  return pricingCount === 0 ? ['Pricing endpoint returned no entries'] : [];
};

const isClaudeApiProvider = (providerType?: AdminModelApiProviderType | string | null) =>
  providerType === 'claude';

const buildModelListHeaders = ({
  apiKey,
  providerType,
}: {
  apiKey: string;
  providerType?: AdminModelApiProviderType | string | null;
}): Record<string, string> => {
  if (isClaudeApiProvider(providerType)) {
    return {
      'Accept': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    };
  }

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
};

export const classifyNewapiModelType = (
  model: Pick<NewapiRemoteModel, 'id' | 'supported_endpoint_types' | 'type'>,
  pricing?: Pick<NewapiRemotePricing, 'supported_endpoint_types'>,
): NewapiModelType => {
  const endpoints = [
    ...(model.supported_endpoint_types ?? []),
    ...(pricing?.supported_endpoint_types ?? []),
  ]
    .map((item) => item.toLowerCase().trim())
    .filter(Boolean);
  const explicitType = model.type?.toLowerCase().trim();
  const id = model.id.toLowerCase();

  if (
    explicitType === 'image' ||
    endpointIncludes(endpoints, ['image', 'images', 'image_generation'])
  ) {
    return 'image';
  }

  if (
    explicitType === 'video' ||
    endpointIncludes(endpoints, ['video', 'videos', 'video_generation'])
  ) {
    return 'video';
  }

  if (explicitType === 'embedding' || endpointIncludes(endpoints, ['embedding', 'embeddings'])) {
    return 'embedding';
  }

  if (
    idIncludes(id, ['image', 'dall-e', 'flux', 'stable-diffusion', 'imagen']) ||
    /\bsd[-_]/.test(id)
  ) {
    return 'image';
  }

  if (idIncludes(id, ['video', 'sora', 'wan', 'hailuo', 'seedance', 'kling', 'veo'])) {
    return 'video';
  }

  if (idIncludes(id, ['embedding', 'embed'])) return 'embedding';

  return 'chat';
};

export const normalizeNewapiSyncRows = ({
  existingRows,
  models,
  pricing,
  pricingStatus = 'available',
}: {
  existingRows: ExistingNewapiModelRow[];
  models: NewapiRemoteModel[];
  pricing: NewapiRemotePricing[];
  pricingStatus?: NewapiPricingSyncStatus;
}): NormalizedNewapiSyncRow[] => {
  const pricingByModel = new Map<string, NewapiRemotePricing>();
  for (const item of pricing) {
    const modelName = item.model_name?.trim();
    if (modelName && !pricingByModel.has(modelName)) pricingByModel.set(modelName, item);
  }

  const existingByKey = new Map(
    existingRows.map((item) => [`${item.modelId}:${item.modelType}`, item]),
  );
  const uniqueModels = new Map<string, NewapiRemoteModel>();
  for (const model of models) {
    const modelId = model.id?.trim();
    if (modelId && !uniqueModels.has(modelId)) uniqueModels.set(modelId, { ...model, id: modelId });
  }

  const activeKeys = new Set<string>();
  const activeRows = [...uniqueModels.values()].map((model, index) => {
    const pricingItem = pricingByModel.get(model.id);
    const modelType = classifyNewapiModelType(model, pricingItem);
    const key = `${model.id}:${modelType}`;
    const existing = existingByKey.get(key);
    activeKeys.add(key);

    const existingMetadata = { ...existing?.metadata };
    delete existingMetadata.staleSince;

    const metadata: Record<string, unknown> = {
      ...existingMetadata,
      syncSource: 'newapi',
      syncStatus: 'active',
    };

    const assignIfDefined = (key: string, value: unknown) => {
      if (value !== undefined) metadata[key] = value;
    };

    assignIfDefined('created', model.created);
    assignIfDefined('object', model.object);
    assignIfDefined('ownedBy', model.owned_by);

    const supportedEndpointTypes = [
      ...(model.supported_endpoint_types ?? []),
      ...(pricingItem?.supported_endpoint_types ?? []),
    ].filter((item, itemIndex, items) => item && items.indexOf(item) === itemIndex);
    if (supportedEndpointTypes.length > 0) {
      metadata.supportedEndpointTypes = supportedEndpointTypes;
    }

    if (pricingStatus === 'available') {
      for (const key of [
        'completionRatio',
        'enableGroups',
        'modelPrice',
        'modelRatio',
        'quotaType',
      ]) {
        delete metadata[key];
      }

      metadata.pricingAvailable = Boolean(pricingItem);
      metadata.pricingSyncStatus = 'available';
      assignIfDefined('completionRatio', pricingItem?.completion_ratio);
      assignIfDefined('enableGroups', pricingItem?.enable_groups);
      assignIfDefined('modelPrice', pricingItem?.model_price);
      assignIfDefined('modelRatio', pricingItem?.model_ratio);
      assignIfDefined('quotaType', pricingItem?.quota_type);
    } else {
      metadata.pricingSyncStatus = pricingStatus;
    }

    return {
      displayName: existing?.displayName?.trim() || pricingItem?.description,
      enabled: existing?.enabled ?? false,
      metadata,
      modelId: model.id,
      modelType,
      sortOrder: existing?.sortOrder ?? index,
    };
  });

  const staleRows = existingRows.flatMap((existing) => {
    const key = `${existing.modelId}:${existing.modelType}`;
    if (activeKeys.has(key) || existing.metadata?.syncSource !== 'newapi') return [];

    return [
      {
        displayName: existing.displayName?.trim() || undefined,
        enabled: false,
        metadata: {
          ...existing.metadata,
          staleSince:
            typeof existing.metadata?.staleSince === 'string'
              ? existing.metadata.staleSince
              : new Date().toISOString(),
          syncSource: 'newapi',
          syncStatus: 'stale',
        },
        modelId: existing.modelId,
        modelType: existing.modelType as NewapiModelType,
        sortOrder: existing.sortOrder ?? activeRows.length,
      },
    ];
  });

  return [...activeRows, ...staleRows];
};

const fetchWithTimeout = async <T>(
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs: number,
  consume: (response: Response) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await consume(response);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} request timed out after ${timeoutMs}ms`, { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const readBoundedJson = async (
  response: Response,
  label: string,
  maxBodyBytes: number,
): Promise<unknown> => {
  const contentLength = Number(response.headers?.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new Error(`${label} response exceeded the ${maxBodyBytes} byte limit`);
  }

  const reader = response.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let bodyBytes = 0;
    let text = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          text += decoder.decode();
          break;
        }

        const chunk = value as Uint8Array;
        bodyBytes += chunk.byteLength;
        if (bodyBytes > maxBodyBytes) {
          await reader.cancel().catch(() => undefined);
          throw new Error(`${label} response exceeded the ${maxBodyBytes} byte limit`);
        }
        text += decoder.decode(chunk, { stream: true });
      }

      return JSON.parse(text);
    } finally {
      reader.releaseLock?.();
    }
  }

  if (typeof response.text === 'function') {
    const text = await response.text();
    const bodyBytes = new TextEncoder().encode(text).byteLength;
    if (bodyBytes > maxBodyBytes) {
      throw new Error(`${label} response exceeded the ${maxBodyBytes} byte limit`);
    }

    return JSON.parse(text);
  }

  return response.json();
};

export const fetchNewapiModels = async ({
  apiKey,
  baseUrl,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  providerType,
  timeoutMs = DEFAULT_CATALOG_TIMEOUT_MS,
}: {
  apiKey: string;
  baseUrl: string;
  maxBodyBytes?: number;
  providerType?: AdminModelApiProviderType | string | null;
  timeoutMs?: number;
}): Promise<NewapiRemoteModel[]> => {
  return fetchWithTimeout(
    urlJoin(normalizeNewapiApiBase(baseUrl), '/models'),
    { headers: buildModelListHeaders({ apiKey, providerType }) },
    'AI provider models',
    timeoutMs,
    async (response) => {
      if (!response.ok) {
        throw new Error(`AI provider models request failed: ${response.status}`);
      }

      const contentType = response.headers?.get('content-type') ?? '';
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw new Error(
          'AI provider models endpoint did not return JSON. Check that the base URL is an API endpoint.',
        );
      }

      let body: unknown;
      try {
        body = await readBoundedJson(response, 'AI provider models', maxBodyBytes);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === `AI provider models response exceeded the ${maxBodyBytes} byte limit`
        ) {
          throw error;
        }

        throw new Error(
          'AI provider models endpoint did not return JSON. Check that the base URL is an API endpoint.',
          { cause: error },
        );
      }

      if (Array.isArray(body)) return body;
      if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
        return (body as { data: NewapiRemoteModel[] }).data;
      }

      return [];
    },
  );
};

export const fetchNewapiPricing = async ({
  apiKey,
  baseUrl,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  providerType = 'newapi',
  timeoutMs = DEFAULT_CATALOG_TIMEOUT_MS,
}: {
  apiKey: string;
  baseUrl: string;
  maxBodyBytes?: number;
  providerType?: AdminModelApiProviderType | string | null;
  timeoutMs?: number;
}): Promise<NewapiPricingFetchResult> => {
  if (!supportsNewapiPricingSync(providerType)) return { items: [], status: 'unsupported' };

  try {
    return await fetchWithTimeout(
      urlJoin(normalizeNewapiRoot(baseUrl), '/api/pricing'),
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
      'NewAPI pricing',
      timeoutMs,
      async (response): Promise<NewapiPricingFetchResult> => {
        if (!response.ok) return { items: [], status: 'unavailable' };

        const contentType = response.headers?.get('content-type') ?? '';
        if (contentType && !contentType.toLowerCase().includes('application/json')) {
          return { items: [], status: 'unavailable' };
        }

        const body = await readBoundedJson(response, 'NewAPI pricing', maxBodyBytes);
        if (
          body &&
          typeof body === 'object' &&
          (body as { success?: boolean }).success &&
          Array.isArray((body as { data?: unknown }).data)
        ) {
          return {
            items: (body as { data: NewapiRemotePricing[] }).data,
            status: 'available',
          };
        }

        return { items: [], status: 'unavailable' };
      },
    );
  } catch {
    return { items: [], status: 'unavailable' };
  }
};
