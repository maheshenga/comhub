// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaRouter } from './index';
import { moduleAppRouter } from './moduleApp';

const {
  mockGetServerDB,
  mockGetSubscriptionPlan,
  mockGetWorkspaceMember,
  mockIngestionService,
  mockAppEnv,
  mockModuleAppGateway,
  mockRunModuleAppAction,
  mockModuleAppModel,
  mockSignModuleAppCapability,
  mockVerifyModuleAppCapability,
} = vi.hoisted(() => ({
  mockAppEnv: {
    MODULE_APP_EXECUTION_ENABLED: true,
    MODULE_APP_RUNTIME_PUBLIC_ORIGIN: 'https://module-runtime.example.com',
  },
  mockGetServerDB: vi.fn(),
  mockGetSubscriptionPlan: vi.fn(),
  mockGetWorkspaceMember: vi.fn(),
  mockIngestionService: {
    issueUpload: vi.fn(),
    submitUpload: vi.fn(),
  },
  mockModuleAppGateway: { call: vi.fn() },
  mockRunModuleAppAction: vi.fn(),
  mockModuleAppModel: {
    createRecord: vi.fn(),
    createRun: vi.fn(),
    getAppDetail: vi.fn(),
    getLaunchInstallationContext: vi.fn(),
    listAdminPackageSubmissions: vi.fn(),
  },
  mockSignModuleAppCapability: vi.fn(),
  mockVerifyModuleAppCapability: vi.fn(),
}));

vi.mock('@/envs/app', () => ({
  appEnv: mockAppEnv,
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: mockGetServerDB,
}));

vi.mock('@/business/server/user', () => ({
  getSubscriptionPlan: mockGetSubscriptionPlan,
}));

vi.mock('@/business/server/module-apps/runModuleAppAction', () => ({
  runModuleAppAction: mockRunModuleAppAction,
}));

vi.mock('@/server/services/moduleAppPackage/ingestion', () => ({
  ModuleAppPackageIngestionService: vi.fn(() => mockIngestionService),
}));

vi.mock('@/server/services/moduleAppRuntime/capability', () => ({
  signModuleAppCapability: mockSignModuleAppCapability,
  verifyModuleAppCapability: mockVerifyModuleAppCapability,
}));

vi.mock('@/database/models/workspaceMember', () => ({
  WorkspaceMemberModel: vi.fn(() => ({ getMember: mockGetWorkspaceMember })),
}));

vi.mock('@/server/services/moduleAppRuntime/gateway', () => ({
  createModuleAppCapabilityGateway: vi.fn(() => mockModuleAppGateway),
}));

vi.mock('@/database/models/moduleApp', () => ({
  ModuleAppModel: vi.fn(() => mockModuleAppModel),
}));

const APP_ID = '00000000-0000-4000-8000-000000000001';

const createCaller = () => moduleAppRouter.createCaller({ userId: 'user-1' } as any);

describe('moduleApp router registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerDB.mockResolvedValue({});
    mockGetSubscriptionPlan.mockResolvedValue('free');
    mockGetWorkspaceMember.mockResolvedValue({ role: 'member', workspaceId: 'workspace-1' });
    mockAppEnv.MODULE_APP_EXECUTION_ENABLED = true;
    mockAppEnv.MODULE_APP_RUNTIME_PUBLIC_ORIGIN = 'https://module-runtime.example.com';
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: false, visible: true },
    });
    mockRunModuleAppAction.mockResolvedValue({
      artifactIds: [],
      billing: { chargedCredits: 0, fixedServiceFeeCharged: false },
      preview: 'Created',
      runId: 'run-1',
      status: 'succeeded',
    });
    mockIngestionService.issueUpload.mockResolvedValue({
      expiresAt: new Date('2026-07-11T02:00:00.000Z'),
      headers: { 'x-amz-acl': 'private' },
      storageKey:
        'module-app-packages/c6c289e49e9c05b2145860387b73bcb1/00000000-0000-4000-8000-000000000011.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
      uploadUrl: 'https://uploads.example.com/package.zip',
    });
    mockIngestionService.submitUpload.mockResolvedValue({
      id: 'package-1',
      reviewStatus: 'pending_review',
    });
    mockVerifyModuleAppCapability.mockResolvedValue({
      appId: APP_ID,
      aud: 'module-runtime',
      exp: 1_783_760_300,
      iat: 1_783_760_000,
      installationId: '00000000-0000-4000-8000-000000000010',
      nonce: '0123456789abcdef0123456789abcdef',
      permissions: ['context.read'],
      surface: 'browser',
      userId: 'user-1',
      versionId: '00000000-0000-4000-8000-000000000011',
    });
    mockModuleAppGateway.call.mockResolvedValue({ appId: APP_ID });
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValue({
      artifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      artifactSha256: 'a'.repeat(64),
      buildArtifactKey: `module-app-builds/build/${'a'.repeat(64)}.tgz`,
      buildArtifactSha256: 'a'.repeat(64),
      buildStatus: 'ready',
      displayName: 'Jobs Board',
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeManifest: {
        build: { frontend: { output: 'dist', profile: 'node22-static' } },
        manifestVersion: 2,
        runtime: {
          functions: [],
          kind: 'sandboxed_app',
          outboundHosts: [],
          permissions: ['context.read'],
        },
      },
      versionId: '00000000-0000-4000-8000-000000000011',
      workspaceId: null,
    });
    mockSignModuleAppCapability.mockResolvedValue('signed-launch-capability');
  });

  it('registers the moduleApp router on lambda root', () => {
    expect(lambdaRouter._def.record.moduleApp).toBeDefined();
  });

  it('returns a scoped launch context for an installed entitled ready application', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).resolves.toMatchObject({
      capability: 'signed-launch-capability',
      iframeUrl: expect.stringContaining('/artifacts/'),
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeOrigin: 'https://module-runtime.example.com',
    });
    expect(mockSignModuleAppCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: APP_ID,
        permissions: ['context.read'],
        surface: 'browser',
        userId: 'user-1',
      }),
      expect.objectContaining({ expiresInSeconds: 300 }),
    );
  });

  it('rejects launch while runtime execution is disabled', async () => {
    mockAppEnv.MODULE_APP_EXECUTION_ENABLED = false;

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_runtime_unavailable',
    });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects uninstalled and suspended applications', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValueOnce(null);
    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'module_app_installation_required',
    });

    mockModuleAppModel.getAppDetail.mockResolvedValueOnce(null);
    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rechecks runnable plan entitlement before launch', async () => {
    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toThrow(
      'plan_run_denied',
    );
    expect(mockModuleAppModel.getLaunchInstallationContext).not.toHaveBeenCalled();
  });

  it('rejects a workspace launch when the user is not a current member', async () => {
    mockGetWorkspaceMember.mockResolvedValueOnce(null);

    await expect(
      createCaller().getLaunchContext({ appId: APP_ID, workspaceId: 'workspace-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('rejects an installation whose immutable build is not ready', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppModel.getLaunchInstallationContext.mockResolvedValueOnce({
      artifactSha256: null,
      buildArtifactSha256: null,
      buildStatus: 'building',
      displayName: 'Jobs Board',
      installationId: '00000000-0000-4000-8000-000000000010',
      runtimeManifest: {},
      versionId: '00000000-0000-4000-8000-000000000011',
      workspaceId: null,
    });

    await expect(createCaller().getLaunchContext({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'module_app_build_not_ready',
    });
    expect(mockSignModuleAppCapability).not.toHaveBeenCalled();
  });

  it('verifies and delegates a browser capability gateway call', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });

    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: {},
        method: 'context.get',
        requestId: 'request-1',
      }),
    ).resolves.toEqual({ appId: APP_ID });

    expect(mockVerifyModuleAppCapability).toHaveBeenCalledWith('signed-capability', {
      userId: 'user-1',
    });
    expect(mockModuleAppGateway.call).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'context.get', requestId: 'request-1' }),
    );
  });

  it('accepts managed data gateway methods', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppGateway.call.mockResolvedValueOnce({ items: [], nextCursor: null });

    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: { tableKey: 'candidates' },
        method: 'data.list',
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('maps managed data validation errors to bad requests', async () => {
    mockModuleAppModel.getAppDetail.mockResolvedValueOnce({
      actions: [],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });
    mockModuleAppGateway.call.mockRejectedValueOnce(
      new Error('MODULE_APP_DATA_SCHEMA_INVALID'),
    );

    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: { tableKey: 'candidates' },
        method: 'data.list',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rechecks the current plan before a browser capability gateway call', async () => {
    await expect(
      createCaller().callSdk({
        capability: 'signed-capability',
        input: {},
        method: 'context.get',
      }),
    ).rejects.toThrow('plan_run_denied');
    expect(mockModuleAppGateway.call).not.toHaveBeenCalled();
  });

  it('rejects runtime capabilities from the user-facing gateway route', async () => {
    mockVerifyModuleAppCapability.mockResolvedValueOnce({
      appId: APP_ID,
      aud: 'module-runtime',
      exp: 1_783_760_300,
      iat: 1_783_760_000,
      installationId: '00000000-0000-4000-8000-000000000010',
      nonce: '0123456789abcdef0123456789abcdef',
      permissions: ['secrets.read'],
      surface: 'runtime',
      userId: 'user-1',
      versionId: '00000000-0000-4000-8000-000000000011',
    });

    await expect(
      createCaller().callSdk({
        capability: 'runtime-capability',
        input: { key: 'CRM_TOKEN' },
        method: 'secrets.get',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockModuleAppGateway.call).not.toHaveBeenCalled();
  });

  it('denies record creation when the current plan cannot run the app', async () => {
    await expect(
      createCaller().createRecord({
        appId: APP_ID,
        collectionKey: 'items',
        data: { title: 'Blocked' },
        scopeType: 'personal',
        title: 'Blocked',
      }),
    ).rejects.toThrow('plan_run_denied');
    expect(mockModuleAppModel.createRecord).not.toHaveBeenCalled();
  });

  it('denies action runs when the current plan cannot run the app', async () => {
    await expect(
      createCaller().runAction({
        actionId: 'create_item',
        appId: APP_ID,
        input: { title: 'Blocked' },
        scopeType: 'personal',
      }),
    ).rejects.toThrow('plan_run_denied');
    expect(mockModuleAppModel.createRun).not.toHaveBeenCalled();
  });

  it('delegates allowed action runs to the module app runtime', async () => {
    const action = {
      id: 'create_item',
      inputSchema: { fields: [] },
      moduleMultiplier: 1,
      name: 'Create item',
      outputSchema: {},
      runtimeConfig: {},
      runtimeType: 'record_create',
    };
    mockModuleAppModel.getAppDetail.mockResolvedValue({
      actions: [action],
      id: APP_ID,
      planState: { installable: true, runnable: true, visible: true },
    });

    await expect(
      createCaller().runAction({
        actionId: 'create_item',
        appId: APP_ID,
        input: { title: 'A' },
        scopeType: 'personal',
      }),
    ).resolves.toMatchObject({ runId: 'run-1', status: 'succeeded' });

    expect(mockRunModuleAppAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        appId: APP_ID,
        input: { title: 'A' },
        model: mockModuleAppModel,
        scopeType: 'personal',
        userId: 'user-1',
      }),
    );
    expect(mockModuleAppModel.createRun).not.toHaveBeenCalled();
  });

  it('delegates package upload issuance to the durable ingestion service', async () => {
    const caller = createCaller();
    const target = await caller.createPackageUpload({
      fileName: 'package-app.zip',
      mimeType: 'application/zip',
      sizeBytes: 256,
    });

    expect(target).toMatchObject({
      expiresAt: new Date('2026-07-11T02:00:00.000Z'),
      headers: { 'x-amz-acl': 'private' },
      storageKey:
        'module-app-packages/c6c289e49e9c05b2145860387b73bcb1/00000000-0000-4000-8000-000000000011.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
      uploadUrl: 'https://uploads.example.com/package.zip',
    });
    expect(mockIngestionService.issueUpload).toHaveBeenCalledWith({
      input: {
        fileName: 'package-app.zip',
        mimeType: 'application/zip',
        sizeBytes: 256,
      },
      userId: 'user-1',
    });
  });

  it('delegates uploaded package submission with the durable upload identity', async () => {
    const input = {
      fileName: 'package-app.zip',
      storageKey:
        'module-app-packages/c6c289e49e9c05b2145860387b73bcb1/00000000-0000-4000-8000-000000000011.zip',
      uploadId: '00000000-0000-4000-8000-000000000010',
    };

    await expect(createCaller().submitUploadedPackage(input)).resolves.toEqual({
      id: 'package-1',
      reviewStatus: 'pending_review',
    });

    expect(mockIngestionService.submitUpload).toHaveBeenCalledWith({ input, userId: 'user-1' });
  });

  it.each([
    ['MODULE_APP_PACKAGE_OPEN_UPLOAD_LIMIT', 'TOO_MANY_REQUESTS'],
    ['MODULE_APP_PACKAGE_STORAGE_QUOTA_EXCEEDED', 'FORBIDDEN'],
    ['MODULE_APP_PACKAGE_UPLOAD_CONFLICT', 'CONFLICT'],
    ['MODULE_APP_PACKAGE_UPLOAD_EXPIRED', 'BAD_REQUEST'],
  ])('maps ingestion error %s to tRPC code %s', async (message, code) => {
    mockIngestionService.issueUpload.mockRejectedValueOnce(new Error(message));

    await expect(
      createCaller().createPackageUpload({
        fileName: 'package-app.zip',
        mimeType: 'application/zip',
        sizeBytes: 256,
      }),
    ).rejects.toMatchObject({ code, message });
  });

  it('lists only the current user package submissions without exposing storage keys', async () => {
    mockModuleAppModel.listAdminPackageSubmissions.mockResolvedValue({
      items: [
        {
          appId: null,
          archive: {
            fileName: 'classified-info.zip',
            mimeType: 'application/zip',
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            storageKey: 'module-app-packages/private/package.zip',
          },
          createdAt: new Date('2026-07-10T00:00:00.000Z'),
          id: 'package-1',
          manifestSnapshot: {
            app: { displayName: 'Classified Info', slug: 'classified-info' },
            packageVersion: '1.2.0',
          },
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewStatus: 'pending_review',
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
      ],
      nextCursor: null,
    });

    const result = await createCaller().listMyPackageSubmissions({
      cursor: 0,
      limit: 20,
    });

    expect(mockModuleAppModel.listAdminPackageSubmissions).toHaveBeenCalledWith({
      cursor: 0,
      limit: 20,
      reviewStatus: undefined,
      submittedByUserId: 'user-1',
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          appDisplayName: 'Classified Info',
          appSlug: 'classified-info',
          fileName: 'classified-info.zip',
          id: 'package-1',
          packageVersion: '1.2.0',
          reviewStatus: 'pending_review',
          sizeBytes: 1024,
        }),
      ],
      nextCursor: null,
    });
    expect(result.items[0]).not.toHaveProperty('archive');
    expect(result.items[0]).not.toHaveProperty('manifestSnapshot');
    expect(result.items[0]).not.toHaveProperty('storageKey');
  });

  it('skips malformed package submissions without failing the current user list', async () => {
    mockModuleAppModel.listAdminPackageSubmissions.mockResolvedValue({
      items: [
        {
          appId: null,
          archive: {
            fileName: 'classified-info.zip',
            mimeType: 'application/zip',
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            storageKey: 'module-app-packages/private/package.zip',
          },
          createdAt: new Date('2026-07-10T00:00:00.000Z'),
          id: 'package-valid',
          manifestSnapshot: {
            app: { displayName: 'Classified Info', slug: 'classified-info' },
            packageVersion: '1.2.0',
          },
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewStatus: 'pending_review',
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
        {
          appId: null,
          archive: { storageKey: 'module-app-packages/private/malformed.zip' },
          createdAt: new Date('2026-07-10T00:00:00.000Z'),
          id: 'package-malformed',
          manifestSnapshot: null,
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewStatus: 'pending_review',
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
      ],
      nextCursor: null,
    });

    const result = await createCaller().listMyPackageSubmissions({
      cursor: 0,
      limit: 20,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        appDisplayName: 'Classified Info',
        id: 'package-valid',
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty('archive');
    expect(result.items[0]).not.toHaveProperty('manifestSnapshot');
    expect(result.items[0]).not.toHaveProperty('storageKey');
  });
});
