import type {
  ModuleAppMarketplaceListInput,
  ModuleAppPackageSubmitInput,
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

export const createModuleAppService = (client: ModuleAppClient) => ({
  archiveRecord: (input: { appId: string; recordId: string; workspaceId?: string }) =>
    client.moduleApp.archiveRecord.mutate!(input),
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
  listRecords: (input: RecordListInput) => client.moduleApp.listRecords.query!(input),
  listRuns: (input: { appId: string }) => client.moduleApp.listRuns.query!(input),
  listTeamApps: (input: { workspaceId: string }) => client.moduleApp.listTeamApps.query!(input),
  runAction: (input: ModuleAppRunInput) => client.moduleApp.runAction.mutate!(input),
  submitPackage: (input: ModuleAppPackageSubmitInput) =>
    client.moduleApp.submitPackage.mutate!(input),
  uninstallPersonal: (input: { appId: string }) =>
    client.moduleApp.uninstallPersonal.mutate!(input),
  updateRecord: (input: ModuleAppRecordInput & { recordId: string }) =>
    client.moduleApp.updateRecord.mutate!(input),
});

export const moduleAppService = createModuleAppService(lambdaClient as unknown as ModuleAppClient);
