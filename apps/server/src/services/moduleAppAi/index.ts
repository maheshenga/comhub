import { consumeStreamUntilDone } from '@lobechat/model-runtime';

import {
  type CommercialUsagePayload,
  estimateCommercialChatCredits,
  quoteCommercialAiUsage,
  shouldChargeCommercialUsage,
} from '@/business/server/commercialBilling';
import type { ModuleAppTextGenerator } from '@/business/server/module-apps/runners/contentGenerationRunner';
import type { AiUsageRouteMetadata } from '@/database/models/commercial';
import { ModuleAppCreditModel } from '@/database/models/moduleAppCredit';
import type { LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

const MAX_MODULE_APP_MULTIPLIER = 100;
const CREDIT_SCALE = 1_000_000;

const roundCredits = (value: number) => Math.round(value * CREDIT_SCALE) / CREDIT_SCALE;

const assertGeneratorInput = (input: Parameters<ModuleAppTextGenerator>[0]) => {
  if (typeof input.chargeAiUsage !== 'boolean') {
    throw new Error('MODULE_APP_AI_CHARGE_MODE_REQUIRED');
  }
  if (!input.provider?.trim() || !input.model?.trim()) {
    throw new Error('MODULE_APP_AI_ROUTE_REQUIRED');
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200) {
    throw new Error('MODULE_APP_AI_IDEMPOTENCY_KEY_INVALID');
  }
  if (
    !Number.isFinite(input.appMultiplier) ||
    input.appMultiplier < 0 ||
    input.appMultiplier > MAX_MODULE_APP_MULTIPLIER ||
    !Number.isFinite(input.actionMultiplier) ||
    input.actionMultiplier < 0 ||
    input.actionMultiplier > MAX_MODULE_APP_MULTIPLIER
  ) {
    throw new Error('MODULE_APP_AI_MULTIPLIER_INVALID');
  }
};

const toTokenUsage = (usage?: CommercialUsagePayload) => ({
  input: usage?.totalInputTokens ?? 0,
  output: usage?.totalOutputTokens ?? 0,
  total: usage?.totalTokens ?? 0,
});

export const createModuleAppTextGenerator = (dependencies: {
  db: LobeChatDatabase;
  workspaceId?: string;
}): ModuleAppTextGenerator => {
  const creditModel = new ModuleAppCreditModel(dependencies.db);

  return async (input) => {
    assertGeneratorInput(input);
    const model = input.model!.trim();
    const provider = input.provider!.trim();
    const combinedMultiplier = roundCredits(input.appMultiplier * input.actionMultiplier);
    const shouldCharge =
      input.chargeAiUsage &&
      (await shouldChargeCommercialUsage({
        db: dependencies.db,
        provider,
        userId: input.userId,
      }));
    const estimatedBaseCredits = shouldCharge
      ? ((await estimateCommercialChatCredits({
          db: dependencies.db,
          payload: {
            messages: [{ content: input.prompt, role: 'user' }],
            model,
          },
          provider,
          userId: input.userId,
        })) ?? 1)
      : 0;
    const estimatedAmount = roundCredits(Math.max(0, estimatedBaseCredits) * combinedMultiplier);
    const reservation =
      estimatedAmount > 0
        ? await creditModel.reserve({
            amount: estimatedAmount,
            idempotencyKey: `module-app-ai:${input.idempotencyKey}`,
            metadata: {
              actionMultiplier: String(input.actionMultiplier),
              appMultiplier: String(input.appMultiplier),
              combinedMultiplier: String(combinedMultiplier),
              model,
              provider,
            },
            payer: dependencies.workspaceId
              ? { scopeType: 'workspace', workspaceId: dependencies.workspaceId }
              : { scopeType: 'personal', userId: input.userId },
          })
        : null;
    if (reservation && reservation.status !== 'active') {
      throw new Error('MODULE_APP_AI_IDEMPOTENCY_REPLAY');
    }

    let providerResponded = false;
    let routeMetadata: AiUsageRouteMetadata | undefined;
    let text = '';
    let usage: CommercialUsagePayload | undefined;

    try {
      const runtime = await initModelRuntimeFromDB(dependencies.db, input.userId, provider, {
        model,
        onRouteResolved: (metadata) => {
          routeMetadata = metadata;
        },
        workspaceId: dependencies.workspaceId,
      });
      const response = await runtime.chat(
        {
          messages: [{ content: input.prompt, role: 'user' }],
          model,
          provider,
        },
        {
          callback: {
            onCompletion: async (data) => {
              usage = data.usage as CommercialUsagePayload | undefined;
            },
            onText: async (chunk) => {
              text += chunk;
            },
          },
          metadata: {
            operationId: input.idempotencyKey,
            skipCommercialBilling: true,
          },
        },
      );
      providerResponded = true;
      await consumeStreamUntilDone(response);

      const quote = usage && shouldCharge
        ? await quoteCommercialAiUsage({
            db: dependencies.db,
            model,
            provider,
            routeMetadata,
            usage,
            usageType: 'chat',
            userId: input.userId,
          })
        : null;
      const baseCredits = quote?.credits ?? (usage ? 0 : estimatedBaseCredits);
      const actualAmount = roundCredits(Math.max(0, baseCredits) * combinedMultiplier);

      if (reservation) {
        await creditModel.settle({
          actualAmount,
          metadata: {
            actionMultiplier: String(input.actionMultiplier),
            appMultiplier: String(input.appMultiplier),
            baseCredits,
            combinedMultiplier: String(combinedMultiplier),
            costSource: quote?.costSource ?? (usage ? 'self-managed' : 'estimate'),
            model,
            pricing: quote?.pricing ?? null,
            provider,
            routeMetadata: routeMetadata ?? null,
            tokenUsage: toTokenUsage(usage),
            usdCost: quote?.usdCost ?? 0,
          },
          reservationId: reservation.id,
        });
      }

      return {
        actualAiCredits: baseCredits,
        text,
        tokenUsage: toTokenUsage(usage),
      };
    } catch (error) {
      if (reservation && !providerResponded) {
        await creditModel.release({
          reason: 'provider_not_started',
          reservationId: reservation.id,
        });
      }
      throw error;
    }
  };
};
