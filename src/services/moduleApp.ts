import type {
  ModuleAppLaunchContext,
  ModuleAppMarketplaceListInput,
  ModuleAppPackageSubmissionListInput,
  ModuleAppPackageSubmissionListResult,
  ModuleAppPackageUploadedSubmitInput,
  ModuleAppPackageUploadRequest,
  ModuleAppPackageUploadTarget,
  ModuleAppRecordInput,
  ModuleAppRunInput,
} from '@lobechat/types';

import { lambdaClient } from '@/libs/trpc/client';

type Procedure = {
  mutate?: (input?: unknown) => Promise<unknown>;
  query?: (input?: unknown) => Promise<unknown>;
};

type ModuleAppClient = {
  moduleApp: Record<string, Procedure>;
};

type RecordListInput = Pick<
  ModuleAppRecordInput,
  'appId' | 'collectionKey' | 'scopeType' | 'workspaceId'
>;

type ModuleAppHistoryInput = {
  cursor?: string;
  installationId: string;
  limit?: number;
  workspaceId?: string;
};

type ModuleAppWorkflowRunInput = Pick<ModuleAppHistoryInput, 'installationId' | 'workspaceId'> & {
  runId: string;
};

export const createModuleAppService = (client: ModuleAppClient, fetcher: typeof fetch = fetch) => {
  const createPackageUpload = async (input: ModuleAppPackageUploadRequest) =>
    (await client.moduleApp.createPackageUpload.mutate!(input)) as ModuleAppPackageUploadTarget;

  const submitUploadedPackage = (input: ModuleAppPackageUploadedSubmitInput) =>
    client.moduleApp.submitUploadedPackage.mutate!(input);

  return {
    archiveRecord: (input: { appId: string; recordId: string; workspaceId?: string }) =>
      client.moduleApp.archiveRecord.mutate!(input),
    cancelWorkflowRun: (input: ModuleAppWorkflowRunInput) =>
      client.moduleApp.cancelWorkflowRun.mutate!(input),
    callSdk: (input: {
      capability: string;
      input?: unknown;
      method: string;
      requestId?: string;
    }) => client.moduleApp.callSdk.mutate!(input),
    createPackageUpload,
    createRecord: (input: ModuleAppRecordInput) => client.moduleApp.createRecord.mutate!(input),
    getDetail: (input: { appIdOrSlug: string }) => client.moduleApp.getDetail.query!(input),
    getLaunchContext: (input: { appId: string; workspaceId?: string }) =>
      client.moduleApp.getLaunchContext.query!(input) as Promise<ModuleAppLaunchContext>,
    getLicense: (input: { appId: string }) => client.moduleApp.getLicense.query!(input),
    getRecord: (input: { appId: string; recordId: string; workspaceId?: string }) =>
      client.moduleApp.getRecord.query!(input),
    getRuntimeManifest: (input: { appId: string }) =>
      client.moduleApp.getRuntimeManifest.query!(input),
    getWorkflowRun: (input: ModuleAppWorkflowRunInput) =>
      client.moduleApp.getWorkflowRun.query!(input),
    installPersonal: (input: { appId: string }) => client.moduleApp.installPersonal.mutate!(input),
    listArtifacts: (input: ModuleAppHistoryInput) => client.moduleApp.listArtifacts.query!(input),
    listMarketplace: (input?: ModuleAppMarketplaceListInput) =>
      client.moduleApp.listMarketplace.query!(input),
    listMyApps: () => client.moduleApp.listMyApps.query!(),
    listOrders: (input: { limit?: number } = {}) => client.moduleApp.listOrders.query!(input),
    listMyPackageSubmissions: (input: ModuleAppPackageSubmissionListInput = {}) =>
      client.moduleApp.listMyPackageSubmissions.query!(
        input,
      ) as Promise<ModuleAppPackageSubmissionListResult>,
    listRecords: (input: RecordListInput) => client.moduleApp.listRecords.query!(input),
    listRuns: (input: ModuleAppHistoryInput) => client.moduleApp.listRuns.query!(input),
    listWorkflowNodes: (input: ModuleAppWorkflowRunInput) =>
      client.moduleApp.listWorkflowNodes.query!(input),
    listTeamApps: (input: { workspaceId: string }) => client.moduleApp.listTeamApps.query!(input),
    runAction: (input: ModuleAppRunInput) => client.moduleApp.runAction.mutate!(input),
    submitUploadedPackage,
    uninstallPersonal: (input: { appId: string }) =>
      client.moduleApp.uninstallPersonal.mutate!(input),
    updateRecord: (input: ModuleAppRecordInput & { recordId: string }) =>
      client.moduleApp.updateRecord.mutate!(input),
    uploadPackage: async (file: File) => {
      const mimeType: ModuleAppPackageUploadRequest['mimeType'] =
        file.type === 'application/x-zip-compressed' || file.type === 'application/octet-stream'
          ? file.type
          : 'application/zip';
      const target = await createPackageUpload({
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
      });
      const response = await fetcher(target.uploadUrl, {
        body: file,
        headers: { ...target.headers, 'Content-Type': mimeType },
        method: 'PUT',
      });

      if (!response.ok) throw new Error('module_app_package_upload_failed');

      return submitUploadedPackage({
        fileName: file.name,
        storageKey: target.storageKey,
        uploadId: target.uploadId,
      });
    },
  };
};

export const moduleAppService = createModuleAppService(lambdaClient as unknown as ModuleAppClient);
