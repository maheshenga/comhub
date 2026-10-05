import type { ModelRuntimeHooks } from '@lobechat/model-runtime';

import { type AiUsageRouteMetadata } from '@/database/models/commercial';

import { createCommercialModelRuntimeHooks } from './commercialModelRuntimeHooks';

export function getBusinessModelRuntimeHooks(
  userId: string,
  provider: string,
  routeMetadataOrWorkspaceId?: AiUsageRouteMetadata | string,
  workspaceId?: string,
): ModelRuntimeHooks | undefined {
  return createCommercialModelRuntimeHooks(
    userId,
    provider,
    routeMetadataOrWorkspaceId,
    workspaceId,
  );
}
