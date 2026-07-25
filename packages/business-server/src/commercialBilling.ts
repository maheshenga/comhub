import { createHash } from 'node:crypto';

import { BRANDING_PROVIDER } from '@lobechat/business-const';
import {
  AgentRuntimeError,
  type ChatStreamPayload,
  resolveImageSinglePrice,
  resolveVideoSinglePrice,
} from '@lobechat/model-runtime';
import { ChatErrorType, type ModuleAppBillingPayer } from '@lobechat/types';
import { getTextInputUnitRate, getTextOutputUnitRate } from '@lobechat/utils';
import { type AiProviderModelListItem } from 'model-bank';

import { AiProviderModel } from '@/database/models/aiProvider';
import { type AiUsageRouteMetadata, CommercialModel } from '@/database/models/commercial';
import { ModuleAppCreditModel } from '@/database/models/moduleAppCredit';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { type LobeChatDatabase } from '@/database/type';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { type ProviderConfig } from '@/types/user/settings';

import { getServerModelPricingSnapshot } from './serverModelPricing';

const USER_MANAGED_CREDENTIAL_FIELDS = [
  'accessKeyId',
  'apiKey',
  'bearerToken',
  'oauthAccessToken',
  'password',
  'secretAccessKey',
  'sessionToken',
  'username',
] as const;

const APPROX_CHARS_PER_TOKEN = 4;
const APPROX_IMAGE_INPUT_TOKENS = 1024;
const APPROX_VIDEO_INPUT_TOKENS = 2048;
const DEFAULT_ESTIMATED_OUTPUT_TOKENS = 1024;
const MIN_ESTIMATED_OUTPUT_TOKENS = 256;
const MAX_ESTIMATED_OUTPUT_TOKENS = 8192;
const MAX_RESERVATION_IDEMPOTENCY_KEY_LENGTH = 240;
const EXTERNAL_SUBSCRIPTION_PROVIDERS = new Set(['supergrok']);

const buildCommercialReservationIdempotencyKey = (
  payer: ModuleAppBillingPayer,
  usageType: CommercialBillableUsageType,
  operationId: string,
) => {
  const payerKey =
    payer.scopeType === 'personal' ? `personal:${payer.userId}` : `workspace:${payer.workspaceId}`;
  const key = `commercial-ai:${payerKey}:${usageType}:${operationId}`;
  if (key.length <= MAX_RESERVATION_IDEMPOTENCY_KEY_LENGTH) return key;

  return `commercial-ai:${createHash('sha256').update(key).digest('hex')}`;
};

const resolveCommercialBillingPayer = ({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId?: string;
}): ModuleAppBillingPayer =>
  workspaceId ? { scopeType: 'workspace', workspaceId } : { scopeType: 'personal', userId };

const hasUserManagedCredential = (keyVaults?: Record<string, unknown>) =>
  USER_MANAGED_CREDENTIAL_FIELDS.some((field) => {
    const value = keyVaults?.[field];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  });

const estimateTextTokens = (value?: string | null) =>
  Math.max(0, Math.ceil((value?.length ?? 0) / APPROX_CHARS_PER_TOKEN));

const estimateMessageTokens = (message: ChatStreamPayload['messages'][number]) => {
  let total = estimateTextTokens(message.name) + estimateTextTokens(message.tool_call_id);

  if (typeof message.content === 'string') {
    total += estimateTextTokens(message.content);
  } else {
    total += (message.content || []).reduce((sum, part) => {
      switch (part.type) {
        case 'image_url': {
          return sum + APPROX_IMAGE_INPUT_TOKENS;
        }
        case 'thinking': {
          return sum + estimateTextTokens(part.thinking);
        }
        case 'text': {
          return sum + estimateTextTokens(part.text);
        }
        case 'video_url': {
          return sum + APPROX_VIDEO_INPUT_TOKENS;
        }
        default: {
          return sum;
        }
      }
    }, 0);
  }

  total += estimateTextTokens(message.reasoning?.content);
  total += (message.tool_calls || []).reduce(
    (sum, toolCall) =>
      sum +
      estimateTextTokens(toolCall.id) +
      estimateTextTokens(toolCall.function?.name) +
      estimateTextTokens(toolCall.function?.arguments),
    0,
  );

  return total;
};

const estimatePayloadInputTokens = (payload: ChatStreamPayload) =>
  Math.max(
    0,
    payload.messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0),
  );

const estimatePayloadOutputTokens = (payload: ChatStreamPayload) => {
  const requestedTokens =
    typeof payload.max_tokens === 'number' && payload.max_tokens > 0
      ? payload.max_tokens
      : DEFAULT_ESTIMATED_OUTPUT_TOKENS;

  return (
    Math.max(MIN_ESTIMATED_OUTPUT_TOKENS, Math.min(MAX_ESTIMATED_OUTPUT_TOKENS, requestedTokens)) *
    Math.max(1, payload.n ?? 1)
  );
};

const estimatePayloadCreditsFromPricing = (
  payload: ChatStreamPayload,
  modelCard?: Pick<AiProviderModelListItem, 'pricing'>,
) => {
  const inputRate = getTextInputUnitRate(modelCard?.pricing);
  const outputRate = getTextOutputUnitRate(modelCard?.pricing);

  if (!inputRate && !outputRate) return undefined;

  const inputCredits = Math.ceil(estimatePayloadInputTokens(payload) * (inputRate ?? 0));
  const outputCredits = Math.ceil(estimatePayloadOutputTokens(payload) * (outputRate ?? 0));

  return Math.max(1, inputCredits + outputCredits);
};

const getProviderModelCard = async ({
  db,
  model,
  modelType = 'chat',
  provider,
  userId,
}: {
  db: LobeChatDatabase;
  model: string;
  modelType?: 'chat' | 'embedding';
  provider: string;
  userId: string;
}) => {
  const { aiProvider } = await getServerGlobalConfig(db);
  const aiInfraRepos = new AiInfraRepos(db, userId, aiProvider as Record<string, ProviderConfig>);
  const models = await aiInfraRepos.getAiProviderModelList(provider, { type: modelType });

  return models.find((item) => item.id === model);
};

export const estimateCommercialChatCredits = async ({
  db,
  payload,
  provider,
  userId,
}: {
  db: LobeChatDatabase;
  payload: ChatStreamPayload;
  provider: string;
  userId: string;
}) => {
  const modelCard = await getProviderModelCard({
    db,
    model: payload.model,
    provider,
    userId,
  });

  return estimatePayloadCreditsFromPricing(payload, modelCard);
};

const estimateEmbeddingInputTokens = (input: unknown): number => {
  if (typeof input === 'string') return estimateTextTokens(input);
  if (!Array.isArray(input)) return 0;
  if (input.every((item) => typeof item === 'number')) return input.length;

  return input.reduce<number>((sum, item) => sum + estimateEmbeddingInputTokens(item), 0);
};

export const estimateCommercialEmbeddingsCredits = async ({
  db,
  input,
  model,
  provider,
  userId,
}: {
  db: LobeChatDatabase;
  input: unknown;
  model: string;
  provider: string;
  userId: string;
}) => {
  const modelCard = await getProviderModelCard({
    db,
    model,
    modelType: 'embedding',
    provider,
    userId,
  });
  const inputRate = getTextInputUnitRate(modelCard?.pricing);
  if (!inputRate) return undefined;

  return Math.max(1, Math.ceil(estimateEmbeddingInputTokens(input) * inputRate));
};

export const shouldChargeCommercialUsage = async ({
  db,
  provider,
  userId,
}: {
  db: LobeChatDatabase;
  provider: string;
  userId: string;
}) => {
  const normalizedProvider = provider.toLowerCase();
  if (EXTERNAL_SUBSCRIPTION_PROVIDERS.has(normalizedProvider)) return false;
  if (normalizedProvider === BRANDING_PROVIDER) return true;

  const providerModel = new AiProviderModel(db, userId);
  const providerConfig = await providerModel.getAiProviderById(
    provider,
    KeyVaultsGateKeeper.getUserKeyVaults,
  );

  return !hasUserManagedCredential(
    providerConfig?.keyVaults as Record<string, unknown> | undefined,
  );
};

export type CommercialBillableUsageType = CommercialAiUsageType | 'image' | 'video';

export interface CommercialUsageReservationHandle {
  estimatedCredits: number;
  operationId: string;
  reservationId: string;
  usageType: CommercialBillableUsageType;
}

export const isCommercialUsageReservationHandle = (
  value: unknown,
  usageType?: CommercialBillableUsageType,
): value is CommercialUsageReservationHandle => {
  if (!value || typeof value !== 'object') return false;

  const handle = value as Partial<CommercialUsageReservationHandle>;
  return (
    typeof handle.reservationId === 'string' &&
    handle.reservationId.length > 0 &&
    typeof handle.operationId === 'string' &&
    handle.operationId.length > 0 &&
    typeof handle.estimatedCredits === 'number' &&
    Number.isFinite(handle.estimatedCredits) &&
    handle.estimatedCredits > 0 &&
    typeof handle.usageType === 'string' &&
    (!usageType || handle.usageType === usageType)
  );
};

const isPositiveFinite = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const hasReliablePricing = (
  pricing: AiProviderModelListItem['pricing'],
  usageType: CommercialBillableUsageType,
) => {
  if (!pricing) return false;

  if (usageType === 'chat' || usageType === 'generate_object') {
    return (
      isPositiveFinite(getTextInputUnitRate(pricing)) ||
      isPositiveFinite(getTextOutputUnitRate(pricing))
    );
  }
  if (usageType === 'embeddings') {
    return isPositiveFinite(getTextInputUnitRate(pricing));
  }
  if (usageType === 'image') {
    const singlePrice = resolveImageSinglePrice(pricing);
    return isPositiveFinite(singlePrice.price) || isPositiveFinite(singlePrice.approximatePrice);
  }

  const singlePrice = resolveVideoSinglePrice(pricing);
  return (
    isPositiveFinite(singlePrice.approximatePrice) ||
    pricing.units.some((unit) => {
      if (unit.name !== 'videoGeneration') return false;
      if (unit.strategy === 'fixed') return isPositiveFinite(unit.rate);
      if (unit.strategy === 'tiered') {
        return unit.tiers.some((tier) => isPositiveFinite(tier.rate));
      }

      return Object.values(unit.lookup.prices).some(isPositiveFinite);
    })
  );
};

export const assertCommercialModelSellable = async ({
  db,
  model,
  provider,
  usageType,
  userId,
}: {
  db: LobeChatDatabase;
  model: string;
  provider: string;
  usageType: CommercialBillableUsageType;
  userId: string;
}): Promise<boolean> => {
  const shouldCharge = await shouldChargeCommercialUsage({ db, provider, userId });
  if (!shouldCharge) return false;

  const snapshot = await getServerModelPricingSnapshot({
    db,
    model,
    provider,
    type:
      usageType === 'generate_object'
        ? 'chat'
        : usageType === 'embeddings'
          ? 'embedding'
          : usageType,
    userId,
  });
  if (hasReliablePricing(snapshot.pricing, usageType)) return true;

  throw AgentRuntimeError.createError(ChatErrorType.Forbidden, {
    message: 'COMMERCIAL_MODEL_PRICING_MISSING',
    model,
    pricingSource: snapshot.source,
    provider,
    reason: 'COMMERCIAL_MODEL_NOT_SELLABLE',
    usageType,
  });
};

export const assertCommercialChatBudget = async ({
  db,
  payload,
  provider,
  userId,
}: {
  db: LobeChatDatabase;
  payload?: ChatStreamPayload;
  provider: string;
  userId: string;
}) => {
  const shouldCharge = await shouldChargeCommercialUsage({ db, provider, userId });
  if (!shouldCharge) return;

  const commercialModel = new CommercialModel(db, userId);
  const estimatedCredits =
    payload && payload.model
      ? await estimateCommercialChatCredits({ db, payload, provider, userId })
      : undefined;
  const canStart = await commercialModel.canStartChatUsage(estimatedCredits);
  if (canStart) return;

  const accountSummary = await commercialModel.getCreditAccountSummary();
  const requiredCredits =
    typeof estimatedCredits === 'number' && Number.isFinite(estimatedCredits)
      ? Math.max(1, Math.ceil(estimatedCredits))
      : undefined;
  const availableCredits = Math.max(0, Math.floor(accountSummary.balance ?? 0));
  const shortfallCredits =
    requiredCredits === undefined ? undefined : Math.max(0, requiredCredits - availableCredits);

  throw AgentRuntimeError.createError(ChatErrorType.InsufficientBudgetForModel, {
    availableCredits,
    currency: accountSummary.currency,
    message: 'COMMERCIAL_BALANCE_EXHAUSTED',
    model: payload?.model,
    provider,
    requiredCredits,
    shortfallCredits,
  });
};

// SECURITY: P1 fix 2026-04-27 - cost=0 fallback to local pricing to prevent gateway bypass
// Conservative fallback rates (USD per million tokens) matching Claude Sonnet pricing tier.
// Used only when modelCard pricing is also unavailable.
const FALLBACK_INPUT_RATE_USD_PER_M = 3;
const FALLBACK_OUTPUT_RATE_USD_PER_M = 15;

export type CostSource = 'fallback-rate' | 'gateway' | 'local-pricing';
export type CommercialAiUsageType = 'chat' | 'embeddings' | 'generate_object';
export type CommercialUsagePayload = {
  cost?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalTokens?: number;
};

/**
 * Resolve the effective USD cost and audit source for a chat usage event.
 *
 * Priority:
 *   1. gateway  — usage.cost > 0 (trust upstream)
 *   2. local-pricing — compute from modelCard.pricing rates × token counts
 *   3. fallback-rate — conservative fixed rate when modelCard has no pricing
 *   4. null — no cost signal and no tokens; cannot bill, caller logs a warning
 */
const resolveEffectiveCost = (
  usage: CommercialUsagePayload,
  modelCard?: Pick<AiProviderModelListItem, 'pricing'>,
  usageType: CommercialAiUsageType = 'chat',
): { costSource: CostSource; usdCost: number } | null => {
  // Tier 1: gateway cost is valid
  if (usage.cost && usage.cost > 0) {
    return { costSource: 'gateway', usdCost: usage.cost };
  }

  // Tiers 2 & 3 require at least some token counts
  const inputTokens =
    usage.totalInputTokens ?? (usageType === 'embeddings' ? (usage.totalTokens ?? 0) : 0);
  const outputTokens =
    usage.totalOutputTokens ?? (usageType === 'embeddings' ? 0 : (usage.totalTokens ?? 0));

  if (inputTokens <= 0 && outputTokens <= 0) {
    console.warn('[billing] cost=0 and no token counts for usage record — skipping charge', {
      usage,
    });
    return null;
  }

  // Tier 2: local pricing from modelCard
  const inputRate = getTextInputUnitRate(modelCard?.pricing);
  const outputRate = getTextOutputUnitRate(modelCard?.pricing);

  if (inputRate !== undefined || outputRate !== undefined) {
    const usdCost = (inputTokens * (inputRate ?? 0) + outputTokens * (outputRate ?? 0)) / 1_000_000;

    if (usdCost > 0) {
      return { costSource: 'local-pricing', usdCost };
    }
  }

  // Tier 3: conservative fallback fixed rate
  const usdCost =
    (inputTokens * FALLBACK_INPUT_RATE_USD_PER_M + outputTokens * FALLBACK_OUTPUT_RATE_USD_PER_M) /
    1_000_000;

  console.warn(
    '[billing] cost=0 and no modelCard pricing — using fallback rate',
    `($${FALLBACK_INPUT_RATE_USD_PER_M}/M input, $${FALLBACK_OUTPUT_RATE_USD_PER_M}/M output)`,
    { model: modelCard, usdCost, usage },
  );

  return { costSource: 'fallback-rate', usdCost };
};

export const assertCommercialMinimumBudget = async ({
  db,
  model,
  provider,
  requiredCredits = 1,
  userId,
}: {
  db: LobeChatDatabase;
  model?: string;
  provider: string;
  requiredCredits?: number;
  userId: string;
}) => {
  const shouldCharge = await shouldChargeCommercialUsage({ db, provider, userId });
  if (!shouldCharge) return;

  const commercialModel = new CommercialModel(db, userId);
  const normalizedRequiredCredits = Math.max(1, Math.ceil(requiredCredits));
  const canStart = await commercialModel.canStartChatUsage(normalizedRequiredCredits);
  if (canStart) return;

  const accountSummary = await commercialModel.getCreditAccountSummary();
  const availableCredits = Math.max(0, Math.floor(accountSummary.balance ?? 0));

  throw AgentRuntimeError.createError(ChatErrorType.InsufficientBudgetForModel, {
    availableCredits,
    currency: accountSummary.currency,
    message: 'COMMERCIAL_BALANCE_EXHAUSTED',
    model,
    provider,
    requiredCredits: normalizedRequiredCredits,
    shortfallCredits: Math.max(0, normalizedRequiredCredits - availableCredits),
  });
};

export const recordCommercialAiUsage = async ({
  db,
  model,
  operationId,
  provider,
  referenceId,
  referenceType,
  routeMetadata,
  title,
  usage,
  usageType,
  userId,
}: {
  db: LobeChatDatabase;
  model: string;
  operationId?: string;
  provider: string;
  referenceId: string;
  referenceType: string;
  routeMetadata?: AiUsageRouteMetadata;
  title?: string;
  usage?: CommercialUsagePayload;
  usageType: CommercialAiUsageType;
  userId: string;
}) => {
  const shouldCharge = await shouldChargeCommercialUsage({ db, provider, userId });
  if (!shouldCharge) return null;
  if (!usage) return null;

  const modelCard = await getProviderModelCard({ db, model, provider, userId });
  const resolved = resolveEffectiveCost(usage, modelCard, usageType);

  if (!resolved) return null;

  const { usdCost, costSource } = resolved;
  const commercialModel = new CommercialModel(db, userId);

  return commercialModel.consumeCreditsForAiUsage({
    model,
    operationId,
    provider,
    referenceId,
    referenceType,
    routeMetadata,
    title,
    usage: {
      ...usage,
      // Override cost with the resolved value so CommercialModel bills correctly.
      // costSource is recorded in the ledger metadata for audit purposes.
      cost: usdCost,
      // Attach costSource as a non-standard audit field accepted by CommercialModel.
      costSource,
    } as typeof usage & { costSource: CostSource },
    usageType,
  });
};

export const reserveCommercialAiUsage = async ({
  db,
  estimatedCredits,
  model,
  operationId,
  provider,
  reservationTtlMs,
  routeMetadata,
  usageType,
  userId,
  workspaceId,
}: {
  db: LobeChatDatabase;
  estimatedCredits?: number;
  model: string;
  operationId: string;
  provider: string;
  reservationTtlMs?: number;
  routeMetadata?: AiUsageRouteMetadata;
  usageType: CommercialBillableUsageType;
  userId: string;
  workspaceId?: string;
}) => {
  const shouldCharge = await assertCommercialModelSellable({
    db,
    model,
    provider,
    usageType,
    userId,
  });
  if (!shouldCharge) return null;

  const amount = Math.max(
    1,
    Math.ceil(
      typeof estimatedCredits === 'number' && Number.isFinite(estimatedCredits)
        ? estimatedCredits
        : 1,
    ),
  );
  const creditModel = reservationTtlMs
    ? new ModuleAppCreditModel(db, { reservationTtlMs })
    : new ModuleAppCreditModel(db);
  const payer = resolveCommercialBillingPayer({ userId, workspaceId });

  return creditModel.reserve({
    amount,
    idempotencyKey: buildCommercialReservationIdempotencyKey(payer, usageType, operationId),
    metadata: {
      model,
      operationId,
      provider,
      ...(routeMetadata ? { routeMetadata } : {}),
      usageType,
      ...(workspaceId ? { workspaceId } : {}),
    },
    payer,
    requireNew: true,
  });
};

export const settleCommercialAiUsageReservation = async ({
  actualCredits,
  db,
  estimatedCredits,
  model,
  operationId,
  provider,
  reservationId,
  routeMetadata,
  title = 'AI Usage',
  usage,
  usageType,
  userId,
}: {
  actualCredits?: number;
  db: LobeChatDatabase;
  estimatedCredits?: number;
  model: string;
  operationId: string;
  provider: string;
  reservationId: string;
  routeMetadata?: AiUsageRouteMetadata;
  title?: string;
  usage?: CommercialUsagePayload;
  usageType: CommercialBillableUsageType;
  userId: string;
}) => {
  let actualAmount = Math.max(
    0,
    Math.ceil(
      typeof actualCredits === 'number' && Number.isFinite(actualCredits)
        ? actualCredits
        : (estimatedCredits ?? 1),
    ),
  );
  let billingMetadata: Record<string, unknown> = {
    ...(actualCredits === undefined
      ? { costSource: 'estimated-reservation' }
      : { chargedCredits: actualAmount, costSource: 'generation-pricing' }),
  };

  if (usage && usageType !== 'image' && usageType !== 'video') {
    const modelCard = await getProviderModelCard({
      db,
      model,
      modelType: usageType === 'embeddings' ? 'embedding' : 'chat',
      provider,
      userId,
    });
    const resolved = resolveEffectiveCost(usage, modelCard, usageType);
    if (resolved) {
      const quote = await new CommercialModel(db, userId).quoteCreditsForAiUsage({
        model,
        provider,
        routeMetadata,
        usage: { cost: resolved.usdCost },
      });
      actualAmount = Math.max(0, quote.amount);
      billingMetadata = {
        chargedCredits: actualAmount,
        costSource: resolved.costSource,
        creditsPerDollar: quote.creditsPerDollar,
        matchedPricingRule: quote.matchedPricingRule,
        pricingMultiplier: quote.pricingMultiplier,
        usdCost: resolved.usdCost,
      };
    }
  }

  return new ModuleAppCreditModel(db).settle({
    actualAmount,
    ledger: {
      description: `Consumed on ${provider}/${model}`,
      referenceType: 'ai_usage_reservation',
      title,
    },
    metadata: {
      ...billingMetadata,
      estimatedCredits: Math.max(1, Math.ceil(estimatedCredits ?? 1)),
      model,
      operationId,
      provider,
      ...(routeMetadata ? { routeMetadata } : {}),
      totalInputTokens: usage?.totalInputTokens ?? 0,
      totalOutputTokens: usage?.totalOutputTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
      usageType,
    },
    reservationId,
  });
};

export const releaseCommercialAiUsageReservation = async ({
  db,
  reason,
  reservationId,
}: {
  db: LobeChatDatabase;
  reason: string;
  reservationId: string;
}) => new ModuleAppCreditModel(db).release({ reason, reservationId });

export const quoteCommercialAiUsage = async ({
  db,
  model,
  provider,
  routeMetadata,
  usage,
  usageType,
  userId,
}: {
  db: LobeChatDatabase;
  model: string;
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  usage?: CommercialUsagePayload;
  usageType: CommercialAiUsageType;
  userId: string;
}) => {
  const shouldCharge = await shouldChargeCommercialUsage({ db, provider, userId });
  if (!shouldCharge || !usage) return null;

  const modelCard = await getProviderModelCard({ db, model, provider, userId });
  const resolved = resolveEffectiveCost(usage, modelCard, usageType);
  if (!resolved) return null;

  const commercialModel = new CommercialModel(db, userId);
  const quote = await commercialModel.quoteCreditsForAiUsage({
    model,
    provider,
    routeMetadata,
    usage: { cost: resolved.usdCost },
  });

  return {
    credits: quote.amount,
    costSource: resolved.costSource,
    pricing: {
      creditsPerDollar: quote.creditsPerDollar,
      matchedPricingRule: quote.matchedPricingRule,
      multiplier: quote.pricingMultiplier,
    },
    usdCost: quote.usdCost,
  };
};

export const recordCommercialChatUsage = async ({
  db,
  messageId,
  model,
  operationId,
  provider,
  routeMetadata,
  usage,
  userId,
}: {
  db: LobeChatDatabase;
  messageId: string;
  model: string;
  operationId?: string;
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  usage?: CommercialUsagePayload;
  userId: string;
}) => {
  return recordCommercialAiUsage({
    db,
    model,
    operationId,
    provider,
    referenceId: messageId,
    referenceType: 'assistant_message',
    routeMetadata,
    title: 'AI Chat Usage',
    usage,
    usageType: 'chat',
    userId,
  });
};
