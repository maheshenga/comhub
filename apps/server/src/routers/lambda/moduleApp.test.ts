// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaRouter } from './index';
import { moduleAppRouter } from './moduleApp';

const {
  mockGetServerDB,
  mockGetSubscriptionPlan,
  mockFileS3,
  mockParseModuleAppPackageArchive,
  mockRunModuleAppAction,
  mockModuleAppModel,
} = vi.hoisted(() => ({
  mockFileS3: {
    createPreSignedUpload: vi.fn(),
    deleteFile: vi.fn(),
    getFileByteArray: vi.fn(),
    getFileMetadata: vi.fn(),
  },
  mockGetServerDB: vi.fn(),
  mockGetSubscriptionPlan: vi.fn(),
  mockParseModuleAppPackageArchive: vi.fn(),
  mockRunModuleAppAction: vi.fn(),
  mockModuleAppModel: {
    createPackageSubmission: vi.fn(),
    createRecord: vi.fn(),
    createRun: vi.fn(),
    getAppDetail: vi.fn(),
    listAdminPackageSubmissions: vi.fn(),
  },
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

vi.mock('@/server/modules/S3', () => ({
  FileS3: vi.fn(() => mockFileS3),
}));

vi.mock('@/server/services/moduleAppPackage/archive', () => ({
  ModuleAppPackageArchiveError: class ModuleAppPackageArchiveError extends Error {},
  parseModuleAppPackageArchive: mockParseModuleAppPackageArchive,
}));

vi.mock('@/database/models/moduleApp', () => ({
  ModuleAppModel: vi.fn(() => mockModuleAppModel),
}));

const APP_ID = '00000000-0000-4000-8000-000000000001';

const createCaller = () => moduleAppRouter.createCaller({ userId: 'user-1' } as any);

const createParsedPackageSubmission = (storageKey: string) => ({
  archive: {
    fileName: 'package-app.zip',
    mimeType: 'application/zip' as const,
    sha256: 'a'.repeat(64),
    sizeBytes: 256,
    storageKey,
  },
  fileManifest: [{ path: 'manifest.json', sha256: 'b'.repeat(64), sizeBytes: 128 }],
  manifest: {
    app: {
      actions: [],
      appType: 'standard_app' as const,
      billing: {},
      category: 'business' as const,
      description: 'A package app.',
      displayName: 'Package App',
      icon: 'Package',
      pages: [],
      slug: 'package-app',
      tags: [],
    },
    entitlements: [],
    manifestVersion: 1 as const,
    packageVersion: '1.0.0',
    runtime: { kind: 'manifest_only' as const, permissions: [] },
  },
});
describe('moduleApp router registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerDB.mockResolvedValue({});
    mockGetSubscriptionPlan.mockResolvedValue('free');
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
    mockFileS3.createPreSignedUpload.mockResolvedValue({
      headers: { 'x-amz-acl': 'private' },
      url: 'https://uploads.example.com/package.zip',
    });
    mockFileS3.getFileMetadata.mockResolvedValue({
      contentLength: 256,
      contentType: 'application/zip',
    });
    mockFileS3.getFileByteArray.mockResolvedValue(new Uint8Array([80, 75, 3, 4]));
    mockFileS3.deleteFile.mockResolvedValue(undefined);
  });

  it('registers the moduleApp router on lambda root', () => {
    expect(lambdaRouter._def.record.moduleApp).toBeDefined();
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

  it('issues a user-scoped package upload target and stores only server-parsed contents', async () => {
    mockModuleAppModel.createPackageSubmission.mockResolvedValue({
      id: 'package-1',
      reviewStatus: 'pending_review',
    });
    const caller = createCaller();
    const target = await caller.createPackageUpload({
      fileName: 'package-app.zip',
      mimeType: 'application/zip',
      sizeBytes: 256,
    });

    expect(target).toMatchObject({
      headers: { 'x-amz-acl': 'private' },
      storageKey: expect.stringMatching(
        /^module-app-packages\/[a-f0-9]{32}\/[0-9a-f-]{36}\.zip$/,
      ),
      uploadUrl: 'https://uploads.example.com/package.zip',
    });
    expect(mockFileS3.createPreSignedUpload).toHaveBeenCalledWith(target.storageKey);

    const parsedSubmission = {
      archive: {
        fileName: 'package-app.zip',
        mimeType: 'application/zip',
        sha256: 'a'.repeat(64),
        sizeBytes: 256,
        storageKey: target.storageKey,
      },
      fileManifest: [{ path: 'manifest.json', sha256: 'b'.repeat(64), sizeBytes: 128 }],
      manifest: {
        app: {
          actions: [],
          appType: 'standard_app',
          billing: {},
          category: 'business',
          description: 'A package app.',
          displayName: 'Package App',
          icon: 'Package',
          pages: [],
          slug: 'package-app',
          tags: [],
        },
        entitlements: [],
        manifestVersion: 1,
        packageVersion: '1.0.0',
        runtime: { kind: 'manifest_only', permissions: [] },
      },
    };
    mockParseModuleAppPackageArchive.mockResolvedValue(parsedSubmission);

    await expect(
      caller.submitUploadedPackage({
        fileName: 'package-app.zip',
        storageKey: target.storageKey,
      }),
    ).resolves.toEqual({ id: 'package-1', reviewStatus: 'pending_review' });

    expect(mockFileS3.getFileMetadata).toHaveBeenCalledWith(target.storageKey);
    expect(mockFileS3.getFileByteArray).toHaveBeenCalledWith(target.storageKey);
    expect(mockParseModuleAppPackageArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'package-app.zip',
        storageKey: target.storageKey,
      }),
    );
    expect(mockModuleAppModel.createPackageSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        ...parsedSubmission,
        submittedByUserId: 'user-1',
        validationReport: [],
      }),
    );
  });

  it('deletes the uploaded package when persistence fails', async () => {
    const target = await createCaller().createPackageUpload({
      fileName: 'package-app.zip',
      mimeType: 'application/zip',
      sizeBytes: 256,
    });
    mockParseModuleAppPackageArchive.mockResolvedValue(
      createParsedPackageSubmission(target.storageKey),
    );
    mockModuleAppModel.createPackageSubmission.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      createCaller().submitUploadedPackage({
        fileName: 'package-app.zip',
        storageKey: target.storageKey,
      }),
    ).rejects.toThrow('database unavailable');

    expect(mockFileS3.deleteFile).toHaveBeenCalledWith(target.storageKey);
  });
  it('rejects package storage keys outside the current user namespace or UUID object shape', async () => {
    await expect(
      createCaller().submitUploadedPackage({
        fileName: 'package-app.zip',
        storageKey: 'module-app-packages/another-user/package.zip',
      }),
    ).rejects.toThrow('module_app_package_storage_key_forbidden');

    const target = await createCaller().createPackageUpload({
      fileName: 'package-app.zip',
      mimeType: 'application/zip',
      sizeBytes: 256,
    });
    await expect(
      createCaller().submitUploadedPackage({
        fileName: 'package-app.zip',
        storageKey: `${target.storageKey}/nested.zip`,
      }),
    ).rejects.toThrow('module_app_package_storage_key_forbidden');

    expect(mockFileS3.getFileMetadata).not.toHaveBeenCalled();
    expect(mockModuleAppModel.createPackageSubmission).not.toHaveBeenCalled();
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