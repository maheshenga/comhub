import type {
  PlatformPluginActionConfig,
  PlatformPluginDetail,
  PlatformPluginPlanEntitlement,
  PlatformPluginRunResult,
} from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { platformPluginRuns } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import { type PlatformPluginArtifactStorage, writePlatformPluginArtifact } from './artifactWriter';
import { writePlatformPluginAuditLog } from './audit';
import { calculatePlatformPluginCharge, type PlatformPluginChargeSnapshot } from './billing';
import { resolvePlatformPluginPermission } from './permission';
import type { PlatformPluginFetch, PlatformPluginRunnerResult } from './runners/apiActionRunner';
import { runApiActionPlugin } from './runners/apiActionRunner';
import {
  type PlatformPluginTextGenerator,
  runContentGenerationPlugin,
} from './runners/contentGenerationRunner';
import { redactPlatformPluginLogValue } from './secrets';
import type { PlatformPluginUrlResolver } from './urlSafety';

type PlatformPluginRunDb = LobeChatDatabase | Transaction;

export type PlatformPluginRunner = () => Promise<PlatformPluginRunnerResult>;

export interface PlatformPluginCommercialModel {
  postCharge: (params: {
    credits: number;
    metadata?: Record<string, unknown>;
    model: string;
    provider: string;
    referenceId?: string;
    referenceType?: string;
    source: string;
    title?: string;
    userId: string;
  }) => Promise<unknown>;
  preCharge: (estimatedCredits: number) => Promise<unknown>;
}

export interface PlatformPluginRunRepository {
  createRun: (input: {
    actionId?: string | null;
    agentId: string;
    inputSnapshot: Record<string, unknown>;
    pluginId: string;
    status: 'running';
    userId: string;
    versionId?: string | null;
  }) => Promise<{ id: string }>;
  updateRun: (input: {
    billingSnapshot?: Record<string, unknown>;
    durationMs?: number;
    errorMessage?: string | null;
    errorType?: string | null;
    outputSnapshot?: Record<string, unknown>;
    runId: string;
    status: 'failed' | 'succeeded';
  }) => Promise<void>;
  writeAuditLog: (input: {
    actorUserId?: string | null;
    eventType: string;
    metadata?: Record<string, unknown> | null;
    resourceId: string;
    resourceType: string;
    targetUserId?: string | null;
  }) => Promise<void>;
}

export interface RunPlatformPluginInput {
  action: PlatformPluginActionConfig;
  actionDbId?: string | null;
  agentBound: boolean;
  agentId: string;
  artifactStorage?: PlatformPluginArtifactStorage;
  commercialModel: PlatformPluginCommercialModel;
  currentPlan: string;
  db?: PlatformPluginRunDb;
  detail: PlatformPluginDetail;
  fetchImpl?: PlatformPluginFetch;
  input: Record<string, unknown>;
  installed: boolean;
  pluginId: string;
  repository?: PlatformPluginRunRepository;
  resolvedSecrets?: Record<string, string>;
  resolveHostname?: PlatformPluginUrlResolver;
  runner?: PlatformPluginRunner;
  textGenerator?: PlatformPluginTextGenerator;
  userId: string;
  versionId?: string | null;
}

const createDbRepository = (db: PlatformPluginRunDb): PlatformPluginRunRepository => ({
  createRun: async (input) => {
    const [row] = await db
      .insert(platformPluginRuns)
      .values({
        actionId: input.actionId ?? null,
        agentId: input.agentId,
        inputSnapshot: redactPlatformPluginLogValue(input.inputSnapshot) as Record<string, unknown>,
        pluginId: input.pluginId,
        status: input.status,
        userId: input.userId,
        versionId: input.versionId ?? null,
      })
      .returning({ id: platformPluginRuns.id });

    if (!row) throw new Error('PLATFORM_PLUGIN_RUN_CREATE_FAILED');

    return row;
  },
  updateRun: async ({ runId, ...input }) => {
    await db
      .update(platformPluginRuns)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(platformPluginRuns.id, runId));
  },
  writeAuditLog: async (input) => {
    await writePlatformPluginAuditLog({ ...input, db });
  },
});

const findEntitlement = (
  detail: PlatformPluginDetail,
  plan: string,
  explicitEntitlement?: PlatformPluginPlanEntitlement | null,
) => explicitEntitlement ?? detail.entitlements.find((item) => item.plan === plan) ?? null;

const resolveRunner = (input: RunPlatformPluginInput): PlatformPluginRunner => {
  if (input.runner) return input.runner;

  if (input.action.runtimeType === 'api_action') {
    return () =>
      runApiActionPlugin({
        action: input.action,
        fetchImpl: input.fetchImpl,
        input: input.input,
        resolveHostname: input.resolveHostname,
        resolvedSecrets: input.resolvedSecrets,
      });
  }

  return () =>
    runContentGenerationPlugin({
      action: input.action,
      input: input.input,
      textGenerator: input.textGenerator,
      userId: input.userId,
    });
};

const toChargeResult = (snapshot: PlatformPluginChargeSnapshot) => ({
  chargedCredits: snapshot.chargeCredits,
  fixedServiceFeeCharged: snapshot.fixedServiceFeeCharged,
});

const getProviderAndModel = (action: PlatformPluginActionConfig) => {
  if (action.runtimeType === 'content_generation') {
    return {
      model: action.contentGeneration?.model ?? action.id,
      provider: action.contentGeneration?.provider ?? 'platform_plugin',
    };
  }

  return {
    model: action.id,
    provider: 'external_api',
  };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'PLATFORM_PLUGIN_RUNTIME_ERROR';

const getIncurredAiCredits = (error: unknown) => {
  const value =
    error && typeof error === 'object'
      ? (error as { aiActualCredits?: unknown }).aiActualCredits
      : undefined;

  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
};

const postChargeIfNeeded = async ({
  action,
  charge,
  commercialModel,
  detail,
  runId,
  userId,
}: {
  action: PlatformPluginActionConfig;
  charge: PlatformPluginChargeSnapshot;
  commercialModel: PlatformPluginCommercialModel;
  detail: PlatformPluginDetail;
  runId: string;
  userId: string;
}) => {
  if (charge.chargeCredits <= 0) return;

  const { model, provider } = getProviderAndModel(action);

  await commercialModel.postCharge({
    credits: charge.chargeCredits,
    metadata: {
      actionId: action.id,
      fixedServiceFeeCharged: charge.fixedServiceFeeCharged,
      moduleMultiplier: charge.moduleMultiplier,
      pluginId: detail.id,
      pluginMultiplier: charge.pluginMultiplier,
    },
    model,
    provider,
    referenceId: runId,
    referenceType: 'platform_plugin_run',
    source: 'platform_plugin',
    title: `Platform Plugin: ${detail.displayName}`,
    userId,
  });
};

export const runPlatformPlugin = async (
  input: RunPlatformPluginInput,
): Promise<PlatformPluginRunResult> => {
  const entitlement = findEntitlement(input.detail, input.currentPlan);
  const decision = resolvePlatformPluginPermission({
    agentBound: input.agentBound,
    entitlement,
    installed: input.installed,
    pluginStatus: input.detail.status,
  });

  if (!decision.runnable.allowed) {
    throw new Error(decision.runnable.reason ?? 'platform_plugin_run_denied');
  }

  const repository = input.repository ?? (input.db ? createDbRepository(input.db) : undefined);
  if (!repository) throw new Error('PLATFORM_PLUGIN_RUN_REPOSITORY_REQUIRED');

  const estimatedCharge = calculatePlatformPluginCharge({
    aiActualCredits: 0,
    billing: input.detail.billing,
    discountPercent: entitlement?.discountPercent ?? 0,
    freeQuotaCreditsRemaining: entitlement?.freeQuotaCredits ?? 0,
    moduleMultiplier: input.action.moduleMultiplier,
    runSucceeded: true,
  });

  if (estimatedCharge.chargeCredits > 0) {
    await input.commercialModel.preCharge(estimatedCharge.chargeCredits);
  }

  const run = await repository.createRun({
    actionId: input.actionDbId ?? null,
    agentId: input.agentId,
    inputSnapshot: input.input,
    pluginId: input.pluginId,
    status: 'running',
    userId: input.userId,
    versionId: input.versionId ?? null,
  });
  const startedAt = Date.now();
  const runner = resolveRunner(input);
  let incurredAiActualCredits = 0;

  try {
    const runnerResult = await runner();
    incurredAiActualCredits = runnerResult.aiActualCredits;
    const charge = calculatePlatformPluginCharge({
      aiActualCredits: runnerResult.aiActualCredits,
      billing: input.detail.billing,
      discountPercent: entitlement?.discountPercent ?? 0,
      freeQuotaCreditsRemaining: entitlement?.freeQuotaCredits ?? 0,
      moduleMultiplier: input.action.moduleMultiplier,
      runSucceeded: true,
    });

    const artifactIds: string[] = [];
    if (input.artifactStorage && input.db) {
      for (const artifact of runnerResult.artifacts) {
        const written = await writePlatformPluginArtifact({
          artifact,
          db: input.db,
          pluginId: input.pluginId,
          runId: run.id,
          storage: input.artifactStorage,
          userId: input.userId,
        });
        artifactIds.push(written.id);
      }
    }

    await postChargeIfNeeded({
      action: input.action,
      charge,
      commercialModel: input.commercialModel,
      detail: input.detail,
      runId: run.id,
      userId: input.userId,
    });

    await repository.updateRun({
      billingSnapshot: charge,
      durationMs: Date.now() - startedAt,
      outputSnapshot: {
        ...runnerResult.outputSnapshot,
        artifactIds,
      },
      runId: run.id,
      status: 'succeeded',
    });
    await repository.writeAuditLog({
      actorUserId: input.userId,
      eventType: 'platform_plugin.run_succeeded',
      metadata: {
        actionId: input.action.id,
        artifactIds,
        billing: charge,
      },
      resourceId: input.pluginId,
      resourceType: 'platformPlugin',
      targetUserId: input.userId,
    });

    return {
      artifactIds,
      billing: toChargeResult(charge),
      preview: runnerResult.preview,
      runId: run.id,
      status: 'succeeded',
    };
  } catch (error) {
    const aiActualCredits = Math.max(getIncurredAiCredits(error), incurredAiActualCredits);
    const charge = calculatePlatformPluginCharge({
      aiActualCredits,
      billing: input.detail.billing,
      discountPercent: entitlement?.discountPercent ?? 0,
      freeQuotaCreditsRemaining: entitlement?.freeQuotaCredits ?? 0,
      moduleMultiplier: input.action.moduleMultiplier,
      runSucceeded: false,
    });
    const safeMessage = String(redactPlatformPluginLogValue(getErrorMessage(error)));

    await postChargeIfNeeded({
      action: input.action,
      charge,
      commercialModel: input.commercialModel,
      detail: input.detail,
      runId: run.id,
      userId: input.userId,
    });
    await repository.updateRun({
      billingSnapshot: charge,
      durationMs: Date.now() - startedAt,
      errorMessage: safeMessage,
      errorType: 'platform_plugin_runtime_error',
      outputSnapshot: {},
      runId: run.id,
      status: 'failed',
    });
    await repository.writeAuditLog({
      actorUserId: input.userId,
      eventType: 'platform_plugin.run_failed',
      metadata: {
        actionId: input.action.id,
        billing: charge,
        errorMessage: safeMessage,
      },
      resourceId: input.pluginId,
      resourceType: 'platformPlugin',
      targetUserId: input.userId,
    });

    return {
      artifactIds: [],
      billing: toChargeResult(charge),
      preview: 'platform_plugin_run_failed',
      runId: run.id,
      status: 'failed',
    };
  }
};
