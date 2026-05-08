import urlJoin from 'url-join';

import type { NewapiModelType } from './index';

export interface NewapiRemoteModel {
  created?: number;
  id: string;
  object?: string;
  owned_by?: string;
  supported_endpoint_types?: string[];
  type?: string;
}

export interface NewapiRemotePricing {
  description?: string;
  model_name: string;
  supported_endpoint_types?: string[];
}

export interface ExistingNewapiModelRow {
  enabled: boolean;
  modelId: string;
  modelType: string;
}

export interface NormalizedNewapiSyncRow {
  displayName?: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  modelId: string;
  modelType: NewapiModelType;
  sortOrder: number;
}

const endpointIncludes = (values: string[], terms: string[]) =>
  values.some((value) => terms.some((term) => value.includes(term)));

const idIncludes = (id: string, terms: string[]) => terms.some((term) => id.includes(term));

const normalizeNewapiRoot = (baseUrl: string) =>
  baseUrl.replace(/\/+$/, '').replace(/\/v\d+[a-z]*\/?$/, '');

const normalizeNewapiApiBase = (baseUrl: string) => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return /\/v\d+[a-z]*$/i.test(trimmed) ? trimmed : urlJoin(trimmed, '/v1');
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
}: {
  existingRows: ExistingNewapiModelRow[];
  models: NewapiRemoteModel[];
  pricing: NewapiRemotePricing[];
}): NormalizedNewapiSyncRow[] => {
  const pricingByModel = new Map(pricing.map((item) => [item.model_name, item]));
  const existingByKey = new Map(
    existingRows.map((item) => [`${item.modelId}:${item.modelType}`, item]),
  );

  return models
    .filter((model) => model.id?.trim())
    .map((model, index) => {
      const pricingItem = pricingByModel.get(model.id);
      const modelType = classifyNewapiModelType(model, pricingItem);
      const existing = existingByKey.get(`${model.id}:${modelType}`);

      return {
        displayName: pricingItem?.description,
        enabled: existing?.enabled ?? false,
        metadata: {
          created: model.created,
          object: model.object,
          ownedBy: model.owned_by,
          pricingAvailable: Boolean(pricingItem),
          supportedEndpointTypes: [
            ...(model.supported_endpoint_types ?? []),
            ...(pricingItem?.supported_endpoint_types ?? []),
          ],
          syncSource: 'newapi',
        },
        modelId: model.id,
        modelType,
        sortOrder: index,
      };
    });
};

export const fetchNewapiModels = async ({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl: string;
}): Promise<NewapiRemoteModel[]> => {
  const response = await fetch(urlJoin(normalizeNewapiApiBase(baseUrl), '/models'), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NewAPI models request failed: ${response.status} ${text}`);
  }

  const contentType = response.headers?.get('content-type') ?? '';
  if (contentType && !contentType.toLowerCase().includes('application/json')) {
    throw new Error('模型列表接口返回的不是 JSON，请检查 NewAPI Base URL 是否填写为 API 地址。');
  }

  let body: { data?: unknown };
  try {
    body = await response.json();
  } catch {
    throw new Error('模型列表接口返回的不是 JSON，请检查 NewAPI Base URL 是否填写为 API 地址。');
  }

  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
};

export const fetchNewapiPricing = async ({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl: string;
}): Promise<NewapiRemotePricing[]> => {
  const response = await fetch(urlJoin(normalizeNewapiRoot(baseUrl), '/api/pricing'), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) return [];

  const contentType = response.headers?.get('content-type') ?? '';
  if (contentType && !contentType.toLowerCase().includes('application/json')) return [];

  let body: { data?: unknown; success?: boolean };
  try {
    body = await response.json();
  } catch {
    return [];
  }

  return body?.success && Array.isArray(body.data) ? body.data : [];
};
