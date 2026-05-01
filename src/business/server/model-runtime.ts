import { type ModelRuntimeHooks } from '@lobechat/model-runtime';

import {
  assertCommercialChatBudget,
  assertCommercialMinimumBudget,
  recordCommercialAiUsage,
  recordCommercialChatUsage,
} from './commercialBilling';
import { getServerDB } from '@/database/core/db-adaptor';

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

const createEphemeralBillingReferenceId = (usageType: 'embeddings' | 'generate_object') =>
  `${usageType}:${
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;

export function getBusinessModelRuntimeHooks(
  userId: string,
  provider: string,
): ModelRuntimeHooks | undefined {
  return {
    beforeChat: async (payload) => {
      const db = await getServerDB();
      await assertCommercialChatBudget({ db, payload, provider, userId });
    },
    beforeEmbeddings: async (payload) => {
      const db = await getServerDB();
      await assertCommercialMinimumBudget({ db, model: payload.model, provider, userId });
    },
    beforeGenerateObject: async (payload) => {
      const db = await getServerDB();
      await assertCommercialChatBudget({ db, payload: payload as any, provider, userId });
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
        title: 'AI Structured Output Usage',
        usage: data.usage,
        usageType: 'generate_object',
        userId,
      });
    },
  };
}
