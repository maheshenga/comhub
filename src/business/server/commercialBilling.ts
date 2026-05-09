import { type ChatStreamPayload, AgentRuntimeError } from '@lobechat/model-runtime';
import { BRANDING_PROVIDER } from '@lobechat/business-const';
import { ChatErrorType } from '@lobechat/types';
import { getTextInputUnitRate, getTextOutputUnitRate } from '@lobechat/utils';
import { type AiProviderModelListItem } from 'model-bank';

import { AiProviderModel } from '@/database/models/aiProvider';
import { type AiUsageRouteMetadata, CommercialModel } from '@/database/models/commercial';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { type LobeChatDatabase } from '@/database/type';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { type ProviderConfig } from '@/types/user/settings';

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
        case 'image_url':
          return sum + APPROX_IMAGE_INPUT_TOKENS;
        case 'thinking':
          return sum + estimateTextTokens(part.thinking);
        case 'text':
          return sum + estimateTextTokens(part.text);
        case 'video_url':
          return sum + APPROX_VIDEO_INPUT_TOKENS;
        default:
          return sum;
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
  provider,
  userId,
}: {
  db: LobeChatDatabase;
  model: string;
  provider: string;
  userId: string;
}) => {
  const { aiProvider } = await getServerGlobalConfig();
  const aiInfraRepos = new AiInfraRepos(db, userId, aiProvider as Record<string, ProviderConfig>);
  const models = await aiInfraRepos.getAiProviderModelList(provider, { type: 'chat' });

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

export const shouldChargeCommercialUsage = async ({
  db,
  provider,
  userId,
}: {
  db: LobeChatDatabase;
  provider: string;
  userId: string;
}) => {
  if (provider.toLowerCase() === BRANDING_PROVIDER) return true;

  const providerModel = new AiProviderModel(db, userId);
  const providerConfig = await providerModel.getAiProviderById(
    provider,
    KeyVaultsGateKeeper.getUserKeyVaults,
  );

  return !hasUserManagedCredential(
    providerConfig?.keyVaults as Record<string, unknown> | undefined,
  );
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

type CostSource = 'fallback-rate' | 'gateway' | 'local-pricing';
type CommercialAiUsageType = 'chat' | 'embeddings' | 'generate_object';
type CommercialUsagePayload = {
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
