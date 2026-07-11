import type {
  ModuleAppActionConfig,
  ModuleAppBillingConfig,
  ModuleAppRunStatus,
  ModuleAppScopeType,
  ModuleAppWorkflowDefinition,
} from '@lobechat/types';

import {
  type ModuleAppArtifactStorage,
  writeModuleAppArtifact,
} from './artifactWriter';
import {
  redactModuleAppLogValue,
  redactResolvedModuleAppSecretValues,
} from './logRedaction';
import {
  type ModuleAppFetch,
  type ModuleAppRunnerArtifactRequest,
  runModuleAppApiAction,
} from './runners/apiActionRunner';
import {
  type ModuleAppTextGenerator,
  runModuleAppContentGeneration,
} from './runners/contentGenerationRunner';
import type { ModuleAppUrlResolver } from './safeUrl';

export interface ModuleAppRuntimeModel {
  archiveRecord: (input: {
    appId: string;
    recordId: string;
    userId: string;
  }) => Promise<unknown>;
  createArtifact?: (input: {
    appId: string;
    expiresAt?: Date | null;
    fileName: string;
    mimeType: string;
    recordId?: null | string;
    runId: string;
    scopeType: ModuleAppScopeType;
    sizeBytes: number;
    storageKey: string;
    userId: string;
    workspaceId?: string;
  }) => Promise<{ id: string }>;
  createRecord: (input: {
    appId: string;
    collectionKey: string;
    data: Record<string, unknown>;
    scopeType: ModuleAppScopeType;
    title?: string;
    userId: string;
    workspaceId?: string;
  }) => Promise<{ id: string }>;
  createRun: (input: {
    actionId: string;
    appId: string;
    input: Record<string, unknown>;
    recordId?: string;
    scopeType: ModuleAppScopeType;
    userId: string;
    workspaceId?: string;
  }) => Promise<{ id: string }>;
  updateRecord: (input: {
    appId: string;
    collectionKey: string;
    data: Record<string, unknown>;
    recordId: string;
    scopeType: ModuleAppScopeType;
    title?: string;
    userId: string;
    workspaceId?: string;
  }) => Promise<{ id: string }>;
  updateRun: (input: {
    billing?: Record<string, unknown>;
    durationMs?: number;
    errorMessage?: string;
    errorType?: string;
    output?: Record<string, unknown>;
    runId: string;
    status: ModuleAppRunStatus;
  }) => Promise<unknown>;
  writeAuditLog?: (input: {
    actorUserId?: null | string;
    eventType: string;
    metadata?: null | Record<string, unknown>;
    resourceId: string;
    resourceType: string;
  }) => Promise<unknown>;
}

export interface RunModuleAppActionInput {
  action: ModuleAppActionConfig;
  appId: string;
  artifactStorage?: ModuleAppArtifactStorage;
  billing?: ModuleAppBillingConfig;
  fetchImpl?: ModuleAppFetch;
  idempotencyKey?: string;
  input: Record<string, unknown>;
  installationId?: string;
  model: ModuleAppRuntimeModel;
  recordId?: string;
  resolvedSecrets?: Record<string, string>;
  resolveHostname?: ModuleAppUrlResolver;
  runner?: ModuleAppActionRunner;
  scopeType: ModuleAppScopeType;
  textGenerator?: ModuleAppTextGenerator;
  userId: string;
  workflow?: ModuleAppWorkflowDefinition;
  workflowEngine?: {
    start: (input: {
      createdBy?: string;
      idempotencyKey: string;
      input: Record<string, unknown>;
      installationId: string;
      workflow: ModuleAppWorkflowDefinition;
    }) => Promise<{ id: string; status: string }>;
  };
  workspaceId?: string;
}

export interface ModuleAppRunnerResult {
  actualAiCredits?: number;
  artifactIds?: string[];
  artifacts?: ModuleAppRunnerArtifactRequest[];
  output?: Record<string, unknown>;
  preview?: string;
}

export type ModuleAppActionRunner = () => Promise<ModuleAppRunnerResult>;

const freeBilling = {
  chargedCredits: 0,
  fixedServiceFeeCharged: false,
};

const defaultBilling: ModuleAppBillingConfig = {
  chargeMode: 'free',
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge',
  fixedServiceFeeCredits: 0,
};

const billableRuntimeTypes = new Set(['api_action', 'content_generation', 'workflow_step']);

const getTextInput = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const getCollectionKey = (action: ModuleAppActionConfig, input: Record<string, unknown>) => {
  const inputCollectionKey = getTextInput(input, 'collectionKey');
  if (inputCollectionKey) return inputCollectionKey;

  const configuredCollectionKey = action.runtimeConfig.collectionKey;
  return typeof configuredCollectionKey === 'string' && configuredCollectionKey.trim()
    ? configuredCollectionKey.trim()
    : 'records';
};

const getRecordId = (input: Record<string, unknown>, fallback?: string) =>
  getTextInput(input, 'recordId') ?? fallback;

const getFiniteNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;

const buildBillingSnapshot = (input: {
  actualAiCredits?: number;
  chargeMode: string;
  externalApiCostCredits?: number;
  failureFixedFeePolicy?: ModuleAppBillingConfig['failureFixedFeePolicy'];
  fixedServiceFeeCredits?: number;
  multiplier?: number;
  runSucceeded?: boolean;
}) => {
  const fixedServiceFeeCredits = input.fixedServiceFeeCredits ?? 0;
  const externalApiCostCredits = input.externalApiCostCredits ?? 0;
  const actualAiCredits = input.actualAiCredits ?? 0;
  const multiplier = input.multiplier ?? 1;
  const aiCredits = actualAiCredits * multiplier;
  const fixedServiceFeeCharged =
    fixedServiceFeeCredits > 0 &&
    (input.runSucceeded !== false || input.failureFixedFeePolicy !== 'do_not_charge');
  const fixedServiceFee = fixedServiceFeeCharged ? fixedServiceFeeCredits : 0;

  return {
    actualAiCredits,
    chargedCredits: fixedServiceFee + externalApiCostCredits + aiCredits,
    chargeMode: input.chargeMode,
    externalApiCostCredits,
    fixedServiceFeeCharged,
    fixedServiceFeeCredits,
    multiplier,
  };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'MODULE_APP_RUNTIME_ERROR';

const getIncurredAiCredits = (error: unknown) => {
  const value =
    error && typeof error === 'object'
      ? ((error as { actualAiCredits?: unknown; aiActualCredits?: unknown }).actualAiCredits ??
        (error as { aiActualCredits?: unknown }).aiActualCredits)
      : undefined;

  return getFiniteNumber(value);
};

const resolveActionRunner = (params: RunModuleAppActionInput): ModuleAppActionRunner => {
  if (params.runner) return params.runner;

  if (params.action.runtimeType === 'api_action') {
    return () =>
      runModuleAppApiAction({
        action: params.action,
        fetchImpl: params.fetchImpl,
        input: params.input,
        resolvedSecrets: params.resolvedSecrets,
        resolveHostname: params.resolveHostname,
      });
  }

  if (params.action.runtimeType === 'content_generation') {
    return () =>
      runModuleAppContentGeneration({
        action: params.action,
        input: params.input,
        textGenerator: params.textGenerator,
        userId: params.userId,
      });
  }

  throw new Error('MODULE_APP_RUNNER_REQUIRED');
};

const writeAudit = async (
  params: RunModuleAppActionInput,
  input: { eventType: string; metadata?: Record<string, unknown> },
) => {
  if (!params.model.writeAuditLog) return;

  await params.model.writeAuditLog({
    actorUserId: params.userId,
    eventType: input.eventType,
    metadata: input.metadata,
    resourceId: params.appId,
    resourceType: 'moduleApp',
  });
};

const writeArtifacts = async (
  params: RunModuleAppActionInput,
  runId: string,
  artifacts: ModuleAppRunnerArtifactRequest[] | undefined,
) => {
  if (!artifacts?.length) return [];
  if (!params.artifactStorage) throw new Error('MODULE_APP_ARTIFACT_STORAGE_REQUIRED');
  if (!params.model.createArtifact) throw new Error('MODULE_APP_ARTIFACT_REPOSITORY_REQUIRED');

  const artifactIds: string[] = [];

  for (const artifact of artifacts) {
    const written = await writeModuleAppArtifact({
      appId: params.appId,
      artifact,
      model: { createArtifact: params.model.createArtifact },
      recordId: params.recordId,
      runId,
      scopeType: params.scopeType,
      storage: params.artifactStorage,
      userId: params.userId,
      workspaceId: params.workspaceId,
    });
    artifactIds.push(written.id);
  }

  return artifactIds;
};

export const runModuleAppAction = async (params: RunModuleAppActionInput) => {
  if (
    params.action.runtimeType === 'workflow_step' &&
    (!params.workflowEngine || !params.workflow || !params.installationId)
  ) {
    throw new Error('MODULE_APP_WORKFLOW_RUNTIME_REQUIRED');
  }
  const run = await params.model.createRun({
    actionId: params.action.id,
    appId: params.appId,
    input: params.input,
    recordId: params.recordId,
    scopeType: params.scopeType,
    userId: params.userId,
    workspaceId: params.workspaceId,
  });

  if (params.action.runtimeType === 'workflow_step') {
    try {
      const workflowRun = await params.workflowEngine!.start({
        createdBy: params.userId,
        idempotencyKey: params.idempotencyKey ?? `${run.id}:${params.action.id}`,
        input: params.input,
        installationId: params.installationId!,
        workflow: params.workflow!,
      });
      await params.model.updateRun({
        billing: freeBilling,
        output: { workflowRunId: workflowRun.id },
        runId: run.id,
        status: 'queued',
      });
      return {
        artifactIds: [],
        billing: freeBilling,
        preview: 'module_app_workflow_queued',
        runId: workflowRun.id,
        status: 'queued' as const,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await params.model.updateRun({
        billing: freeBilling,
        errorMessage,
        errorType: 'module_app_workflow_start_error',
        output: {},
        runId: run.id,
        status: 'failed',
      });
      return {
        artifactIds: [],
        billing: freeBilling,
        preview: 'module_app_run_failed',
        runId: run.id,
        status: 'failed' as const,
      };
    }
  }

  if (params.action.runtimeType === 'record_create') {
    const record = await params.model.createRecord({
      appId: params.appId,
      collectionKey: getCollectionKey(params.action, params.input),
      data: params.input,
      scopeType: params.scopeType,
      title: getTextInput(params.input, 'title'),
      userId: params.userId,
      workspaceId: params.workspaceId,
    });
    const preview = getTextInput(params.input, 'title') ?? record.id;
    const output = { preview, recordId: record.id };

    await params.model.updateRun({
      billing: freeBilling,
      output,
      runId: run.id,
      status: 'succeeded',
    });

    return {
      artifactIds: [],
      billing: freeBilling,
      preview,
      runId: run.id,
      status: 'succeeded' as const,
    };
  }

  if (params.action.runtimeType === 'record_update') {
    const recordId = getRecordId(params.input, params.recordId);
    if (!recordId) throw new Error('MODULE_APP_RECORD_ID_REQUIRED');

    const record = await params.model.updateRecord({
      appId: params.appId,
      collectionKey: getCollectionKey(params.action, params.input),
      data: params.input,
      recordId,
      scopeType: params.scopeType,
      title: getTextInput(params.input, 'title'),
      userId: params.userId,
      workspaceId: params.workspaceId,
    });
    const preview = getTextInput(params.input, 'title') ?? record.id;
    const output = { preview, recordId: record.id };

    await params.model.updateRun({
      billing: freeBilling,
      output,
      runId: run.id,
      status: 'succeeded',
    });

    return {
      artifactIds: [],
      billing: freeBilling,
      preview,
      runId: run.id,
      status: 'succeeded' as const,
    };
  }

  if (params.action.runtimeType === 'record_archive') {
    const recordId = getRecordId(params.input, params.recordId);
    if (!recordId) throw new Error('MODULE_APP_RECORD_ID_REQUIRED');

    await params.model.archiveRecord({
      appId: params.appId,
      recordId,
      userId: params.userId,
    });
    const output = { preview: 'Archived', recordId };

    await params.model.updateRun({
      billing: freeBilling,
      output,
      runId: run.id,
      status: 'succeeded',
    });

    return {
      artifactIds: [],
      billing: freeBilling,
      preview: 'Archived',
      runId: run.id,
      status: 'succeeded' as const,
    };
  }

  if (billableRuntimeTypes.has(params.action.runtimeType)) {
    const startedAt = Date.now();
    const runner = resolveActionRunner(params);
    const billing = params.billing ?? defaultBilling;

    try {
      const runnerResult = await runner();
      const billingSnapshot = buildBillingSnapshot({
        actualAiCredits: getFiniteNumber(runnerResult.actualAiCredits),
        chargeMode: billing.chargeMode,
        externalApiCostCredits: billing.externalApiCostCredits,
        failureFixedFeePolicy: billing.failureFixedFeePolicy,
        fixedServiceFeeCredits: billing.fixedServiceFeeCredits,
        multiplier: billing.defaultMultiplier * params.action.moduleMultiplier,
        runSucceeded: true,
      });
      const writtenArtifactIds = await writeArtifacts(params, run.id, runnerResult.artifacts);
      const artifactIds = [...(runnerResult.artifactIds ?? []), ...writtenArtifactIds];
      const output = {
        ...runnerResult.output,
        ...(artifactIds.length > 0 ? { artifactIds } : {}),
      };

      await params.model.updateRun({
        billing: billingSnapshot,
        durationMs: Date.now() - startedAt,
        output,
        runId: run.id,
        status: 'succeeded',
      });
      await writeAudit(params, {
        eventType: 'module_app.run_succeeded',
        metadata: {
          actionId: params.action.id,
          artifactIds,
          billing: billingSnapshot,
        },
      });

      return {
        artifactIds,
        billing: billingSnapshot,
        preview: runnerResult.preview ?? '',
        runId: run.id,
        status: 'succeeded' as const,
      };
    } catch (error) {
      const safeMessage = String(
        redactResolvedModuleAppSecretValues(
          getErrorMessage(error),
          params.resolvedSecrets ?? {},
        ),
      );
      const billingSnapshot = buildBillingSnapshot({
        actualAiCredits: getIncurredAiCredits(error),
        chargeMode: billing.chargeMode,
        externalApiCostCredits: billing.externalApiCostCredits,
        failureFixedFeePolicy: billing.failureFixedFeePolicy,
        fixedServiceFeeCredits: billing.fixedServiceFeeCredits,
        multiplier: billing.defaultMultiplier * params.action.moduleMultiplier,
        runSucceeded: false,
      });

      await params.model.updateRun({
        billing: billingSnapshot,
        durationMs: Date.now() - startedAt,
        errorMessage: safeMessage,
        errorType: 'module_app_runtime_error',
        output: {},
        runId: run.id,
        status: 'failed',
      });
      await writeAudit(params, {
        eventType: 'module_app.run_failed',
        metadata: redactModuleAppLogValue({
          actionId: params.action.id,
          billing: billingSnapshot,
          errorMessage: safeMessage,
        }) as Record<string, unknown>,
      });

      return {
        artifactIds: [],
        billing: billingSnapshot,
        preview: 'module_app_run_failed',
        runId: run.id,
        status: 'failed' as const,
      };
    }
  }

  throw new Error(`MODULE_APP_RUNTIME_NOT_IMPLEMENTED:${params.action.runtimeType}`);
};
