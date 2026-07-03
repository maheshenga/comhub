import { type ModelRuntimeHooks } from '@lobechat/model-runtime';

import { getServerDB } from '@/database/core/db-adaptor';
import { type AiUsageRouteMetadata } from '@/database/models/commercial';

import {
  assertCommercialChatBudget,
  assertCommercialMinimumBudget,
  recordCommercialAiUsage,
  recordCommercialChatUsage,
} from './commercialBilling';
import { assertModelPolicyAllowed } from './modelPolicy';
import { assertPlanModelAllowed } from './planModelRules';

const COMMERCIAL_BILLING_REFERENCE_KEYS = [
  'messageId',
  'assistantMessageId',
  'operationId',
] as const;

const getStringMetadataValue = (
  metadata: Record<string, unknown> | undefined,
  key: (typeof COMMERCIAL_BILLING_REFERENCE_KEYS)[number],
) => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const resolveCommercialBillingReferenceId = (metadata?: Record<string, unknown>) => {
  for (const key of COMMERCIAL_BILLING_REFERENCE_KEYS) {
    const value = getStringMetadataValue(metadata, key);
    if (value) return value;
  }

  return undefined;
};

const shouldSkipCommercialBilling = (metadata?: Record<string, unknown>) =>
  metadata?.skipCommercialBilling === true;

const createEphemeralBillingReferenceId = (
  usageType: 'embeddings' | 'generate_object' | 'image' | 'video',
) =>
  `${usageType}:${
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;

export function getBusinessModelRuntimeHooks(
  userId: string,
  provider: string,
  routeMetadataOrWorkspaceId?: AiUsageRouteMetadata | string,
  _workspaceId?: string,
): ModelRuntimeHooks | undefined {
  const routeMetadata =
    typeof routeMetadataOrWorkspaceId === 'string' ? undefined : routeMetadataOrWorkspaceId;
  const policyProviderAliases = Array.from(
    new Set([routeMetadata?.providerType, routeMetadata ? 'newapi' : undefined].filter(Boolean)),
  ).filter((alias): alias is string => typeof alias === 'string' && alias !== provider);
  const policyParams = (
    db: Awaited<ReturnType<typeof getServerDB>>,
    model: string | undefined,
    usageType: 'chat' | 'embeddings' | 'generate_object' | 'image' | 'video',
  ) => ({
    db,
    model,
    provider,
    ...(policyProviderAliases.length > 0 ? { providerAliases: policyProviderAliases } : {}),
    usageType,
  });

  return {
    beforeChat: async (payload) => {
      const db = await getServerDB();
      const groupKey = routeMetadata?.groupKey ?? undefined;
      await assertModelPolicyAllowed(policyParams(db, payload.model, 'chat'));
      await assertPlanModelAllowed({
        db,
        ...(groupKey ? { groupKey } : {}),
        model: payload.model,
        modelType: 'chat',
        userId,
      });
      await assertCommercialChatBudget({ db, payload, provider, userId });
    },
    beforeEmbeddings: async (payload) => {
      const db = await getServerDB();
      const groupKey = routeMetadata?.groupKey ?? undefined;
      await assertModelPolicyAllowed(policyParams(db, payload.model, 'embeddings'));
      await assertPlanModelAllowed({
        db,
        ...(groupKey ? { groupKey } : {}),
        model: payload.model,
        modelType: 'embedding',
        userId,
      });
      await assertCommercialMinimumBudget({ db, model: payload.model, provider, userId });
    },
    beforeGenerateObject: async (payload) => {
      const db = await getServerDB();
      const groupKey = routeMetadata?.groupKey ?? undefined;
      await assertModelPolicyAllowed(policyParams(db, payload.model, 'generate_object'));
      await assertPlanModelAllowed({
        db,
        ...(groupKey ? { groupKey } : {}),
        model: payload.model,
        modelType: 'chat',
        userId,
      });
      await assertCommercialChatBudget({ db, payload: payload as any, provider, userId });
    },
    beforeCreateImage: async (payload) => {
      const db = await getServerDB();
      const groupKey = routeMetadata?.groupKey ?? undefined;
      await assertModelPolicyAllowed(policyParams(db, payload.model, 'image'));
      await assertPlanModelAllowed({
        db,
        ...(groupKey ? { groupKey } : {}),
        model: payload.model,
        modelType: 'image',
        userId,
      });
      await assertCommercialMinimumBudget({ db, model: payload.model, provider, userId });
    },
    beforeCreateVideo: async (payload) => {
      const db = await getServerDB();
      const groupKey = routeMetadata?.groupKey ?? undefined;
      await assertModelPolicyAllowed(policyParams(db, payload.model, 'video'));
      await assertPlanModelAllowed({
        db,
        ...(groupKey ? { groupKey } : {}),
        model: payload.model,
        modelType: 'video',
        userId,
      });
      await assertCommercialMinimumBudget({ db, model: payload.model, provider, userId });
    },
    onChatFinal: async (data, { options, payload }) => {
      const metadata = options?.metadata;
      if (shouldSkipCommercialBilling(metadata)) return;
      if (!data.usage) return;

      const messageId = resolveCommercialBillingReferenceId(metadata);
      if (!messageId) {
        console.warn('[billing] skip chat usage charge because no billing reference metadata', {
          model: payload.model,
          provider,
        });
        return;
      }

      const db = await getServerDB();
      await recordCommercialChatUsage({
        db,
        messageId,
        model: payload.model,
        operationId: getStringMetadataValue(metadata, 'operationId'),
        provider,
        routeMetadata,
        usage: data.usage,
        userId,
      });
    },
    onEmbeddingsFinal: async (data, { options, payload }) => {
      const metadata = options?.metadata;
      if (shouldSkipCommercialBilling(metadata)) return;
      if (!data.usage) return;

      const referenceId =
        resolveCommercialBillingReferenceId(metadata) ||
        createEphemeralBillingReferenceId('embeddings');
      const db = await getServerDB();

      await recordCommercialAiUsage({
        db,
        model: payload.model,
        operationId: getStringMetadataValue(metadata, 'operationId'),
        provider,
        referenceId,
        referenceType: 'model_runtime_embeddings',
        routeMetadata,
        title: 'AI Embeddings Usage',
        usage: data.usage,
        usageType: 'embeddings',
        userId,
      });
    },
    onGenerateObjectFinal: async (data, { options, payload }) => {
      const metadata = options?.metadata;
      if (shouldSkipCommercialBilling(metadata)) return;
      if (!data.usage) return;

      const referenceId =
        resolveCommercialBillingReferenceId(metadata) ||
        createEphemeralBillingReferenceId('generate_object');
      const db = await getServerDB();

      await recordCommercialAiUsage({
        db,
        model: payload.model,
        operationId: getStringMetadataValue(metadata, 'operationId'),
        provider,
        referenceId,
        referenceType: 'model_runtime_generate_object',
        routeMetadata,
        title: 'AI Structured Output Usage',
        usage: data.usage,
        usageType: 'generate_object',
        userId,
      });
    },
  };
}
