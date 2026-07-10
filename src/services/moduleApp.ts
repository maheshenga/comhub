import type {
  ModuleAppMarketplaceListInput,
  ModuleAppPackageSubmissionListInput,
  ModuleAppPackageSubmissionListResult,
  ModuleAppPackageUploadedSubmitInput,
  ModuleAppPackageUploadRequest,
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

type ModuleAppPackageUploadTarget = {
  headers: Record<string, string>;
  storageKey: string;
  uploadUrl: string;
};

export const createModuleAppService = (client: ModuleAppClient, fetcher: typeof fetch = fetch) => {
  const createPackageUpload = async (input: ModuleAppPackageUploadRequest) =>
    (await client.moduleApp.createPackageUpload.mutate!(input)) as ModuleAppPackageUploadTarget;

  const submitUploadedPackage = (input: ModuleAppPackageUploadedSubmitInput) =>
    client.moduleApp.submitUploadedPackage.mutate!(input);

  return {
    archiveRecord: (input: { appId: string; recordId: string; workspaceId?: string }) =>
      client.moduleApp.archiveRecord.mutate!(input),
    createPackageUpload,
    createRecord: (input: ModuleAppRecordInput) => client.moduleApp.createRecord.mutate!(input),
    getDetail: (input: { appIdOrSlug: string }) => client.moduleApp.getDetail.query!(input),
    getRecord: (input: { appId: string; recordId: string; workspaceId?: string }) =>
      client.moduleApp.getRecord.query!(input),
    getRuntimeManifest: (input: { appId: string }) =>
      client.moduleApp.getRuntimeManifest.query!(input),
    installPersonal: (input: { appId: string }) => client.moduleApp.installPersonal.mutate!(input),
    listArtifacts: (input: { appId: string }) => client.moduleApp.listArtifacts.query!(input),
    listMarketplace: (input?: ModuleAppMarketplaceListInput) =>
      client.moduleApp.listMarketplace.query!(input),
    listMyApps: () => client.moduleApp.listMyApps.query!(),
    listMyPackageSubmissions: (input: ModuleAppPackageSubmissionListInput = {}) =>
      client.moduleApp.listMyPackageSubmissions.query!(
        input,
      ) as Promise<ModuleAppPackageSubmissionListResult>,
    listRecords: (input: RecordListInput) => client.moduleApp.listRecords.query!(input),
    listRuns: (input: { appId: string }) => client.moduleApp.listRuns.query!(input),
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

      return submitUploadedPackage({ fileName: file.name, storageKey: target.storageKey });
    },
  };
};

export const moduleAppService = createModuleAppService(lambdaClient as unknown as ModuleAppClient);
