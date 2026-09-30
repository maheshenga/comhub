import type { mergeModelRuntimeHooks, ModelRuntime } from '@lobechat/model-runtime';
import type { ClientSecretPayload } from '@lobechat/types';
import { ModelProvider } from 'model-bank';

import { getBusinessModelRuntimeHooks } from '@/business/server/model-runtime';
import type { AiUsageRouteMetadata } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';
import { createLLMGenerationTracingHook } from '@/server/services/llmGenerationTracing/hook';
import {
  type AdminModelApiProviderType,
  buildNewapiRouteMetadata,
  type NewapiModelType,
  resolveDefaultNewapiInstance,
  type ResolvedNewapiInstance,
  resolveNewapiInstanceByProviderId,
  resolveNewapiInstancesForModel,
} from '@/server/services/newapiInstance';

import {
  buildPayloadFromKeyVaults,
  initModelRuntimeWithUserPayload,
  type ProviderKeyVaults,
} from './index';

/**
 * ComHub NewAPI route resolution.
 *
 * The entire admin-managed NewAPI layer is fork-added: multi-instance routing
 * by model/user plan, per-provider runtime translation, failover on 5xx /
 * network errors, and NewAPI route metadata for group-aware billing. This
 * module owns it so the upstream-shaped initModelRuntimeFromDB in index.ts
 * only delegates one call here.
 *
 * Invariants:
 * - failover retries carry the same billing/tracing hooks (ledger writes are
 *   idempotent by billing reference);
 * - requireAdminManagedNewapi fails closed when no route is available and
 *   never reads user-supplied NewAPI credentials.
 */

export interface NewapiRoutingOptions {
  model?: string | null;
  modelType?: NewapiModelType;
  onRouteResolved?: (routeMetadata: AiUsageRouteMetadata | undefined) => void;
  requireAdminManagedNewapi?: boolean;
}

export const resolveAdminRuntimeProvider = (
  providerType?: AdminModelApiProviderType | null,
): string => {
  switch (providerType) {
    case 'openai':
    case 'openai-compatible': {
      return ModelProvider.OpenAI;
    }
    case 'claude': {
      return ModelProvider.Anthropic;
    }
    case 'deepseek': {
      return ModelProvider.DeepSeek;
    }
    case 'aliyun': {
      return ModelProvider.Qwen;
    }
    case 'opencode-go': {
      return ModelProvider.OpenCodeCodingPlan;
    }
    case 'newapi':
    default: {
      return ModelProvider.NewAPI;
    }
  }
};

/**
 * Wraps a ModelRuntime to add automatic failover for NewAPI instances.
 * When the primary instance returns a retriable error (5xx, network), this
 * wrapper retries with the next fallback instance in priority order.
 */
const wrapNewapiRuntimeWithFailover = (
  runtime: ModelRuntime,
  payload: ClientSecretPayload,
  failoverInstances: ResolvedNewapiInstance[],
  userId: string,
  provider: string,
  workspaceId?: string,
  onRouteResolved?: (routeMetadata: AiUsageRouteMetadata | undefined) => void,
): ModelRuntime => {
  const originalChat = runtime.chat.bind(runtime);

  runtime.chat = async function (chatPayload, options?) {
    try {
      return await originalChat(chatPayload, options);
    } catch (primaryError) {
      const statusCode = (primaryError as any)?.statusCode;
      const is5xx = typeof statusCode === 'number' && statusCode >= 500;
      const isNetwork = ['NetworkError', 'ServiceUnavailable', 'TimeoutError'].includes(
        (primaryError as any)?.errorType,
      );

      if (!is5xx && !isNetwork) throw primaryError;

      // Try fallback instances in order. The final successful runtime still needs
      // billing/tracing hooks; ledger writes are idempotent by billing reference.
      for (const instance of failoverInstances) {
        try {
          const fallbackPayload = {
            ...payload,
            apiKey: instance.apiKey,
            baseURL: instance.baseUrl,
          };
          const fallbackRuntimeProvider = resolveAdminRuntimeProvider(instance.providerType);
          fallbackPayload.runtimeProvider = fallbackRuntimeProvider;
          const fallbackBusinessHooks = getBusinessModelRuntimeHooks(
            userId,
            provider,
            buildNewapiRouteMetadata(instance),
            workspaceId,
          );
          const fallbackTracingHooks = createLLMGenerationTracingHook(
            userId,
            provider,
            workspaceId,
          );
          const fallbackHooks = mergeModelRuntimeHooks(fallbackBusinessHooks, fallbackTracingHooks);
          const fallbackRuntime = await initModelRuntimeWithUserPayload(
            fallbackRuntimeProvider,
            fallbackPayload,
            { userId, workspaceId },
            fallbackHooks,
          );
          console.warn(
            `[newapi-failover] primary failed (${statusCode}), retrying on instance "${instance.instanceName}" (priority ${instance.priority})`,
          );
          onRouteResolved?.(buildNewapiRouteMetadata(instance));
          return await fallbackRuntime.chat(chatPayload, options);
        } catch {
          // Continue to next fallback
        }
      }

      // All fallbacks exhausted, throw the original error
      throw primaryError;
    }
  };

  return runtime;
};

/**
 * Resolve the admin-managed NewAPI route for a request and initialize the
 * runtime against the winning instance.
 *
 * Returns undefined when the provider is NOT admin-managed NewAPI (caller
 * falls back to the standard upstream path).
 */
export const initModelRuntimeFromNewapiRoute = async (params: {
  db: LobeChatDatabase;
  keyVaults: ProviderKeyVaults;
  options: NewapiRoutingOptions;
  provider: string;
  userId: string;
  workspaceId?: string;
}): Promise<ModelRuntime | undefined> => {
  const { db, options, provider, userId, workspaceId } = params;

  const adminManagedInstance =
    provider === ModelProvider.NewAPI
      ? null
      : await resolveNewapiInstanceByProviderId(db, provider);
  const isAdminManagedNewapiProvider = provider === ModelProvider.NewAPI || !!adminManagedInstance;
  if (!isAdminManagedNewapiProvider) return undefined;

  // Multi-instance routing: when a specific model is in flight, prefer the
  // highest-priority enabled instance that has it registered. Otherwise use
  // the default (lowest-priority enabled) instance.
  let resolvedInstances: ResolvedNewapiInstance[];
  if (adminManagedInstance && params.options.model) {
    resolvedInstances = await resolveNewapiInstancesForModel(db, {
      modelId: params.options.model,
      modelType: params.options.modelType ?? 'chat',
      preferredInstanceId: adminManagedInstance.instanceId,
      userId,
    });
  } else if (adminManagedInstance) {
    resolvedInstances = [adminManagedInstance];
  } else if (params.options.model) {
    resolvedInstances = await resolveNewapiInstancesForModel(db, {
      modelId: params.options.model,
      modelType: params.options.modelType ?? 'chat',
      userId,
    });
  } else {
    const defaultInstance = await resolveDefaultNewapiInstance(db);
    resolvedInstances = defaultInstance ? [defaultInstance] : [];
  }

  const primary = resolvedInstances[0];
  if (!primary && params.options.requireAdminManagedNewapi) {
    throw new Error('MODULE_APP_NEWAPI_ROUTE_NOT_AVAILABLE');
  }

  const payload = buildPayloadFromKeyVaults(params.keyVaults, ModelProvider.NewAPI);
  if (primary) {
    if (params.options.requireAdminManagedNewapi) {
      payload.apiKey = primary.apiKey;
      payload.baseURL = primary.baseUrl;
    } else {
      payload.apiKey ||= primary.apiKey;
      payload.baseURL ||= primary.baseUrl;
    }
  }
  const adminRuntimeProvider = resolveAdminRuntimeProvider(primary?.providerType);
  payload.runtimeProvider = adminRuntimeProvider;

  // Store fallback instances for failover (exclude primary which is already set)
  const fallbackInstances = resolvedInstances.slice(1);

  // Compose business billing hooks with llm_generation_tracing. The tracing
  // hook is no-op when unconfigured, while business hooks receive NewAPI route
  // metadata for group-aware billing.
  const routeMetadata = buildNewapiRouteMetadata(primary);
  params.options.onRouteResolved?.(routeMetadata);
  const businessHooks = getBusinessModelRuntimeHooks(userId, provider, routeMetadata, workspaceId);
  const tracingHooks = createLLMGenerationTracingHook(userId, provider, workspaceId);
  const hooks = mergeModelRuntimeHooks(businessHooks, tracingHooks);

  // Initialize ModelRuntime with the payload and hooks
  const runtime = await initModelRuntimeWithUserPayload(
    adminRuntimeProvider,
    payload,
    { userId, workspaceId },
    hooks,
  );

  // Wire up NewAPI failover: if the primary instance returns a retriable
  // error (5xx / network), automatically retry with the next fallback instance.
  if (fallbackInstances.length > 0) {
    return wrapNewapiRuntimeWithFailover(
      runtime,
      payload,
      fallbackInstances,
      userId,
      provider,
      workspaceId,
      params.options.onRouteResolved,
    );
  }

  return runtime;
};
