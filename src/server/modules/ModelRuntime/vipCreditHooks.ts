import type { ModelRuntimeHooks } from '@lobechat/model-runtime';
import { AgentRuntimeErrorType } from '@lobechat/types';

import { CreditTransactionModel } from '@/database/models/creditTransaction';
import { NotificationModel } from '@/database/models/notification';
import { UserCreditsModel } from '@/database/models/userCredits';
import type { LobeChatDatabase } from '@/database/type';
import { getAppConfig } from '@/envs/app';

import { getGatewayConfigFromDB } from './platformProvider';

/**
 * Per-model pricing configuration.
 * Loaded from site_config DB (platform_newapi_model_pricing) or env var fallback.
 * Format: { "gpt-4o": { "input": 2.5, "output": 10 }, ... }
 * Rates are credits per million tokens.
 */
interface ModelPricingEntry {
  input: number;
  output: number;
}

let _modelPricingCache: Record<string, ModelPricingEntry> | null = null;
let _modelPricingCacheTs = 0;
const MODEL_PRICING_CACHE_TTL = 60_000; // 60 seconds

const getModelPricing = (dbModelPricing?: string | null): Record<string, ModelPricingEntry> => {
  const now = Date.now();
  if (_modelPricingCache !== null && now - _modelPricingCacheTs < MODEL_PRICING_CACHE_TTL) {
    return _modelPricingCache;
  }

  // Try DB value first, then env var
  const raw = dbModelPricing || getAppConfig().PLATFORM_NEWAPI_MODEL_PRICING;
  if (!raw) {
    _modelPricingCache = {};
    _modelPricingCacheTs = now;
    return _modelPricingCache;
  }

  try {
    _modelPricingCache = JSON.parse(raw) as Record<string, ModelPricingEntry>;
  } catch {
    console.error('[VipCreditHooks] Failed to parse PLATFORM_NEWAPI_MODEL_PRICING');
    _modelPricingCache = {};
  }
  _modelPricingCacheTs = now;
  return _modelPricingCache;
};

// Default fallback rates (credits per million tokens)
const DEFAULT_INPUT_RATE = 1; // 1 credit per 1M input tokens
const DEFAULT_OUTPUT_RATE = 3; // 3 credits per 1M output tokens

// Default credit reserve for pre-deduction (enough for a typical short chat)
const DEFAULT_RESERVE_CREDITS = 500;

// Low balance threshold for sending notifications
const LOW_BALANCE_THRESHOLD = 500;

/**
 * Calculate credit cost from token usage using per-model pricing.
 * Falls back to default rates when no model-specific pricing is configured.
 */
const calculateCreditCost = (model: string, inputTokens: number, outputTokens: number, dbPricing?: string | null): number => {
  const pricing = getModelPricing(dbPricing);
  const modelPricing = pricing[model];

  const inputRate = modelPricing?.input ?? DEFAULT_INPUT_RATE;
  const outputRate = modelPricing?.output ?? DEFAULT_OUTPUT_RATE;

  // Rates are per million tokens — compute cost and round up
  return Math.ceil((inputTokens * inputRate + outputTokens * outputRate) / 1_000_000);
};

/**
 * Create ModelRuntimeHooks that deduct credits from a VIP user's balance
 * after each successful LLM call.
 *
 * These hooks are only attached when a user is routed through the platform
 * NewAPI gateway (i.e., they are a VIP user without their own API key).
 *
 * Lifecycle:
 * - beforeChat: pre-deduct a reserve of credits atomically (abort if insufficient)
 * - onChatFinal: calculate actual cost, reconcile (refund excess or charge more)
 * - onChatError: refund the reserved credits since the call failed
 */
export const createVipCreditHooks = (
  db: LobeChatDatabase,
  userId: string,
): ModelRuntimeHooks => {
  // Track reserved amount per-request via closure
  let reservedCredits = 0;
  // Preloaded model pricing from DB (populated in beforeChat)
  let dbModelPricing: string | null = null;

  return {
    beforeChat: async () => {
      // Preload model pricing from DB for use in onChatFinal
      try {
        const gwConfig = await getGatewayConfigFromDB(db);
        dbModelPricing = gwConfig.modelPricing;
      } catch { /* non-critical */ }
      const creditsModel = new UserCreditsModel(db);

      // Atomically pre-deduct reserve credits
      const result = await creditsModel.deductCredits(userId, DEFAULT_RESERVE_CREDITS);

      if (!result) {
        // Check if they have ANY credits for a more informative error
        const credits = await creditsModel.getOrCreate(userId);
        if (credits.balance <= 0) {
          throw {
            error: { message: 'INSUFFICIENT_CREDITS' },
            errorType: AgentRuntimeErrorType.InsufficientQuota,
            provider: 'platform',
          };
        }

        // They have some credits but less than the full reserve — try to reserve what they have
        const smallResult = await creditsModel.deductCredits(userId, credits.balance);
        if (!smallResult || credits.balance <= 0) {
          throw {
            error: { message: 'INSUFFICIENT_CREDITS' },
            errorType: AgentRuntimeErrorType.InsufficientQuota,
            provider: 'platform',
          };
        }
        reservedCredits = credits.balance;
        return;
      }

      reservedCredits = DEFAULT_RESERVE_CREDITS;
    },

    onChatFinal: async (data, context) => {
      const { usage } = data;
      const model = context.payload?.model || 'unknown';
      const inputTokens = usage?.totalInputTokens ?? 0;
      const outputTokens = usage?.totalOutputTokens ?? 0;

      const actualCost = (inputTokens === 0 && outputTokens === 0)
        ? 0
        : calculateCreditCost(model, inputTokens, outputTokens, dbModelPricing);

      const creditsModel = new UserCreditsModel(db);
      const txModel = new CreditTransactionModel(db);

      // Reconcile: reserved vs actual
      const delta = actualCost - reservedCredits;

      if (delta > 0) {
        // Actual cost exceeded reserve — try to charge the difference
        await creditsModel.deductCredits(userId, delta);
      } else if (delta < 0) {
        // Reserve exceeded actual cost — refund the excess
        await creditsModel.addCredits(userId, Math.abs(delta));
      }
      // else: perfect match, no reconciliation needed

      // Record the transaction with actual cost
      if (actualCost !== 0) {
        await txModel.create({
          userId,
          amount: -actualCost,
          type: 'usage_deduct',
          description: `Model: ${model} | In: ${inputTokens} Out: ${outputTokens}`,
          model,
          tokensInput: inputTokens,
          tokensOutput: outputTokens,
        });
      } else if (reservedCredits > 0) {
        // No usage but credits were reserved — this shouldn't happen normally,
        // but refund was already handled above. Record a zero-cost tx for audit.
        await txModel.create({
          userId,
          amount: 0,
          type: 'usage_deduct',
          description: `Model: ${model} | No token usage (reserved ${reservedCredits} refunded)`,
          model,
          tokensInput: 0,
          tokensOutput: 0,
        });
      }

      // S3: Check if balance is low and send a notification
      try {
        const updatedCredits = await creditsModel.getOrCreate(userId);
        if (updatedCredits.balance > 0 && updatedCredits.balance <= LOW_BALANCE_THRESHOLD) {
          const yearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const notifModel = new NotificationModel(db, userId);
          await notifModel.create({
            category: 'credits',
            type: 'low_balance',
            title: '积分余额不足',
            content: `您的积分余额仅剩 ${updatedCredits.balance}，建议及时充值或续费以避免服务中断。`,
            dedupeKey: `low_balance_${userId}_${yearMonth}`,
            actionUrl: '/settings/vip',
          });
        }
      } catch {
        // Non-critical — don't fail the main flow
      }

      // Reset for safety
      reservedCredits = 0;
    },

    onChatError: async () => {
      // If beforeChat reserved credits but the LLM call failed, refund them
      if (reservedCredits > 0) {
        const creditsModel = new UserCreditsModel(db);
        await creditsModel.addCredits(userId, reservedCredits);
        reservedCredits = 0;
      }
    },
  };
};
