import type { ModuleAppActionConfig, ModuleAppScopeType } from '@lobechat/types';

export interface ModuleAppRuntimeModel {
  archiveRecord: (input: {
    appId: string;
    recordId: string;
    userId: string;
  }) => Promise<unknown>;
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
    output?: Record<string, unknown>;
    runId: string;
    status: 'succeeded';
  }) => Promise<unknown>;
}

export interface RunModuleAppActionInput {
  action: ModuleAppActionConfig;
  appId: string;
  input: Record<string, unknown>;
  model: ModuleAppRuntimeModel;
  recordId?: string;
  scopeType: ModuleAppScopeType;
  userId: string;
  workspaceId?: string;
}

const freeBilling = {
  chargedCredits: 0,
  fixedServiceFeeCharged: false,
};

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

export const runModuleAppAction = async (params: RunModuleAppActionInput) => {
  const run = await params.model.createRun({
    actionId: params.action.id,
    appId: params.appId,
    input: params.input,
    recordId: params.recordId,
    scopeType: params.scopeType,
    userId: params.userId,
    workspaceId: params.workspaceId,
  });

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

  throw new Error(`MODULE_APP_RUNTIME_NOT_IMPLEMENTED:${params.action.runtimeType}`);
};
