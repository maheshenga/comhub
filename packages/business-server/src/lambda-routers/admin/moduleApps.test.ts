import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { writeModuleAppAuditLog } from '../../module-apps/audit';
import { adminRouter } from './index';

const moduleAppModelMocks = vi.hoisted(() => ({
  approvePackageSubmissionForAdmin: vi.fn(),
  getAdminApp: vi.fn(),
  getAdminPackageSubmission: vi.fn(),
  listAdminPackageSubmissions: vi.fn(),
  rejectPackageSubmissionForAdmin: vi.fn(),
  setStatus: vi.fn(),
  upsertAppForAdmin: vi.fn(),
}));

const lifecycleMocks = vi.hoisted(() => ({
  releaseRejectedPackage: vi.fn(),
  rescanLegacyPackage: vi.fn(),
}));

const buildServiceMocks = vi.hoisted(() => ({
  approvePackage: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/moduleApp', () => ({
  ModuleAppModel: vi.fn(() => moduleAppModelMocks),
}));

vi.mock('@/server/services/moduleAppPackage/lifecycle', () => ({
  ModuleAppPackageLifecycleService: vi.fn(() => lifecycleMocks),
}));

vi.mock('@/server/services/moduleAppBuild/service', () => ({
  ModuleAppBuildService: vi.fn(() => buildServiceMocks),
}));

vi.mock('../../module-apps/audit', () => ({
  writeModuleAppAuditLog: vi.fn(),
}));

vi.mock('./audit-router', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminAuditRouter: router({}) };
});

vi.mock('./content', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminContentRouter: router({}) };
});

vi.mock('./credits', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminCreditsRouter: router({}) };
});

vi.mock('./newapiProviders', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminNewapiProvidersRouter: router({}) };
});

vi.mock('./orders', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminOrdersRouter: router({}) };
});

vi.mock('./plans', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminPlansRouter: router({}) };
});

vi.mock('./ppt', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminPptRouter: router({}) };
});

vi.mock('./redemption', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminRedemptionRouter: router({}) };
});

vi.mock('./referral', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminReferralRouter: router({}) };
});

vi.mock('./settings', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminSettingsRouter: router({}) };
});

vi.mock('./stats', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminStatsRouter: router({}) };
});

vi.mock('./subscriptions', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminSubscriptionsRouter: router({}) };
});

vi.mock('./topupPackages', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminTopUpPackagesRouter: router({}) };
});

vi.mock('./users', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return { adminUsersRouter: router({}) };
});

const APP_ID = '00000000-0000-4000-8000-000000000001';
const PACKAGE_ID = '00000000-0000-4000-8000-000000000011';

const createDb = () =>
  ({
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
      },
    },
  }) as any;

const createCaller = () => {
  vi.mocked(getServerDB).mockResolvedValue(createDb());

  return adminRouter.createCaller({ userId: 'admin-user' } as any);
};

describe('admin module apps router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moduleAppModelMocks.getAdminApp.mockResolvedValue({ id: APP_ID, slug: 'workbench' });
    moduleAppModelMocks.getAdminPackageSubmission.mockResolvedValue({
      id: PACKAGE_ID,
      reviewStatus: 'pending_review',
    });
    moduleAppModelMocks.listAdminPackageSubmissions.mockResolvedValue({
      items: [{ id: PACKAGE_ID }],
      nextCursor: null,
    });
    moduleAppModelMocks.approvePackageSubmissionForAdmin.mockResolvedValue({
      appId: APP_ID,
      package: { id: PACKAGE_ID, reviewStatus: 'approved' },
      slug: 'workbench',
      versionId: 'version-1',
    });
    buildServiceMocks.approvePackage.mockResolvedValue({
      appId: APP_ID,
      build: { id: 'build-1', status: 'queued' },
      package: { id: PACKAGE_ID, reviewStatus: 'approved' },
      slug: 'workbench',
      versionId: 'version-1',
    });
    moduleAppModelMocks.rejectPackageSubmissionForAdmin.mockResolvedValue({
      id: PACKAGE_ID,
      reviewStatus: 'rejected',
    });
    lifecycleMocks.releaseRejectedPackage.mockResolvedValue({
      cleanupQueued: false,
      package: { id: PACKAGE_ID, reviewStatus: 'rejected' },
    });
    lifecycleMocks.rescanLegacyPackage.mockResolvedValue({
      cleanupQueued: false,
      issueCodes: [],
      packageId: PACKAGE_ID,
      scanStatus: 'clean',
    });
    moduleAppModelMocks.setStatus.mockResolvedValue({ ok: true });
    moduleAppModelMocks.upsertAppForAdmin.mockResolvedValue({ id: APP_ID, slug: 'workbench' });
  });

  it('registers admin.moduleApps', () => {
    expect(adminRouter._def.record.moduleApps).toBeDefined();
  });

  it('writes an audit log when upserting a module app', async () => {
    const caller = createCaller();

    const result = await caller.moduleApps.upsert({
      actions: [],
      appType: 'standard_app',
      billing: {
        chargeMode: 'free',
        defaultMultiplier: 1,
        externalApiCostCredits: 0,
        failureFixedFeePolicy: 'do_not_charge',
        fixedServiceFeeCredits: 0,
      },
      category: 'office',
      description: 'Simple workbench app.',
      displayName: 'Workbench',
      icon: 'Blocks',
      pages: [],
      slug: 'workbench',
      status: 'draft',
      tags: [],
    });

    expect(result).toEqual({ id: APP_ID, slug: 'workbench' });
    expect(moduleAppModelMocks.upsertAppForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Workbench', slug: 'workbench' }),
    );
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.upserted',
        resourceId: APP_ID,
        resourceType: 'moduleApp',
      }),
    );
  });

  it('writes an audit log when publishing a module app', async () => {
    const caller = createCaller();

    await expect(caller.moduleApps.publish({ appId: APP_ID })).resolves.toEqual({ ok: true });

    expect(moduleAppModelMocks.setStatus).toHaveBeenCalledWith({
      appId: APP_ID,
      status: 'published',
    });
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.published',
        resourceId: APP_ID,
        resourceType: 'moduleApp',
      }),
    );
  });

  it('does not publish or audit a missing module app', async () => {
    moduleAppModelMocks.getAdminApp.mockResolvedValue(null);
    const caller = createCaller();

    await expect(caller.moduleApps.publish({ appId: APP_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'module_app_not_found',
    });

    expect(moduleAppModelMocks.setStatus).not.toHaveBeenCalled();
    expect(writeModuleAppAuditLog).not.toHaveBeenCalled();
  });

  it('maps an executable build gate to a precondition error without a success audit', async () => {
    moduleAppModelMocks.setStatus.mockRejectedValueOnce(new Error('MODULE_APP_BUILD_NOT_READY'));
    const caller = createCaller();

    await expect(caller.moduleApps.publish({ appId: APP_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'MODULE_APP_BUILD_NOT_READY',
    });
    expect(writeModuleAppAuditLog).not.toHaveBeenCalled();
  });

  it('lists module app package submissions for review', async () => {
    const caller = createCaller();

    await expect(caller.moduleApps.listPackages({ reviewStatus: 'pending_review' })).resolves.toEqual({
      items: [{ id: PACKAGE_ID }],
      nextCursor: null,
    });

    expect(moduleAppModelMocks.listAdminPackageSubmissions).toHaveBeenCalledWith({
      cursor: 0,
      limit: 50,
      reviewStatus: 'pending_review',
    });
  });

  it('approves a package submission and writes an audit log', async () => {
    const caller = createCaller();

    await expect(caller.moduleApps.approvePackage({ packageId: PACKAGE_ID })).resolves.toEqual({
      appId: APP_ID,
      build: { id: 'build-1', status: 'queued' },
      package: { id: PACKAGE_ID, reviewStatus: 'approved' },
      slug: 'workbench',
      versionId: 'version-1',
    });

    expect(buildServiceMocks.approvePackage).toHaveBeenCalledWith({
      packageId: PACKAGE_ID,
      reviewedByUserId: 'admin-user',
    });
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.package_approved',
        resourceId: APP_ID,
        resourceType: 'moduleApp',
      }),
    );
  });

  it('maps a non-clean package approval to a precondition error', async () => {
    buildServiceMocks.approvePackage.mockRejectedValueOnce(
      new Error('MODULE_APP_PACKAGE_SCAN_NOT_CLEAN'),
    );
    const caller = createCaller();

    await expect(caller.moduleApps.approvePackage({ packageId: PACKAGE_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'MODULE_APP_PACKAGE_SCAN_NOT_CLEAN',
    });
  });

  it('rescans a legacy package and writes an audit log', async () => {
    const caller = createCaller();

    await expect(caller.moduleApps.rescanPackage({ packageId: PACKAGE_ID })).resolves.toEqual({
      cleanupQueued: false,
      issueCodes: [],
      packageId: PACKAGE_ID,
      scanStatus: 'clean',
    });

    expect(lifecycleMocks.rescanLegacyPackage).toHaveBeenCalledWith({
      packageId: PACKAGE_ID,
      reviewedByUserId: 'admin-user',
    });
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.package_rescanned',
        resourceId: PACKAGE_ID,
        resourceType: 'moduleAppPackage',
      }),
    );
  });

  it('maps a rescan remediation error without writing a success audit', async () => {
    lifecycleMocks.rescanLegacyPackage.mockRejectedValueOnce(
      new Error('MODULE_APP_PACKAGE_RESCAN_OBJECT_MISSING'),
    );
    const caller = createCaller();

    await expect(caller.moduleApps.rescanPackage({ packageId: PACKAGE_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'MODULE_APP_PACKAGE_RESCAN_OBJECT_MISSING',
    });
    expect(writeModuleAppAuditLog).not.toHaveBeenCalled();
  });

  it('rejects a package submission and writes an audit log', async () => {
    const caller = createCaller();

    await expect(
      caller.moduleApps.rejectPackage({ packageId: PACKAGE_ID, reason: 'Unsafe manifest' }),
    ).resolves.toEqual({
      cleanupQueued: false,
      package: { id: PACKAGE_ID, reviewStatus: 'rejected' },
    });

    expect(lifecycleMocks.releaseRejectedPackage).toHaveBeenCalledWith({
      packageId: PACKAGE_ID,
      reason: 'Unsafe manifest',
      reviewedByUserId: 'admin-user',
    });
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.package_rejected',
        resourceId: PACKAGE_ID,
        resourceType: 'moduleAppPackage',
      }),
    );
  });
});
