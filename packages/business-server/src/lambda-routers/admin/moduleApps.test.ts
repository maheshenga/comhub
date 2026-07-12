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

const moduleAppCommerceMocks = vi.hoisted(() => ({
  refundOrder: vi.fn(),
  settleOrder: vi.fn(),
}));

const moduleAppRevenueMocks = vi.hoisted(() => ({
  listRevenue: vi.fn(),
  settleBatchWithAudit: vi.fn(),
}));

const moduleAppOrderRevenueMocks = vi.hoisted(() => ({
  refundOrder: vi.fn(),
  settleOrder: vi.fn(),
}));

const moduleAppPaymentMocks = vi.hoisted(() => ({
  reconcilePayment: vi.fn(),
  reconcilePendingPayments: vi.fn(),
  reconcileRefund: vi.fn(),
  refundOrder: vi.fn(),
}));

const moduleAppPaymentModelMocks = vi.hoisted(() => ({
  acknowledgeDiscrepancy: vi.fn(),
  listDiscrepancies: vi.fn(),
}));

const moduleAppPublisherMocks = vi.hoisted(() => ({
  assignApplication: vi.fn(),
  createPublisher: vi.fn(),
  listPublishers: vi.fn(),
  suspendPublisher: vi.fn(),
  verifyPublisher: vi.fn(),
}));

const moduleAppPayoutMocks = vi.hoisted(() => ({
  createEligibleBatch: vi.fn(),
  listPayouts: vi.fn(),
  recordManualAlipayPayout: vi.fn(),
  transitionBatch: vi.fn(),
}));

const moduleAppReadModelMocks = vi.hoisted(() => ({
  listApplications: vi.fn(),
  listArtifacts: vi.fn(),
  listAuditEvents: vi.fn(),
  listInstalls: vi.fn(),
  listPackages: vi.fn(),
  listPaymentDiagnostics: vi.fn(),
  listPayouts: vi.fn(),
  listPublishers: vi.fn(),
  listRecords: vi.fn(),
  listRevenue: vi.fn(),
  listRuns: vi.fn(),
}));

const mockAppEnv = vi.hoisted(() => ({ MODULE_APP_ALIPAY_ENABLED: true }));
const mockCreateConfiguredModuleAppAlipayClient = vi.hoisted(() => vi.fn(() => ({})));

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

vi.mock('@/database/models/moduleAppPayment', () => ({
  ModuleAppPaymentModel: vi.fn(() => moduleAppPaymentModelMocks),
}));

vi.mock('@/database/models/moduleAppPublisher', () => ({
  ModuleAppPublisherModel: vi.fn(() => moduleAppPublisherMocks),
}));

vi.mock('@/database/models/moduleAppPayout', () => ({
  ModuleAppPayoutModel: vi.fn(() => moduleAppPayoutMocks),
}));

vi.mock('./moduleApps.readModels', () => ({
  ModuleAppAdminReadModel: vi.fn(() => moduleAppReadModelMocks),
}));

vi.mock('@/envs/app', () => ({ appEnv: mockAppEnv }));

vi.mock('@/server/services/moduleAppPayments/alipay/client', () => ({
  createConfiguredModuleAppAlipayClient: mockCreateConfiguredModuleAppAlipayClient,
}));

vi.mock('../../module-apps/payments/service', () => ({
  ModuleAppPaymentService: vi.fn(() => moduleAppPaymentMocks),
}));

vi.mock('@/database/models/moduleAppCommerce', () => ({
  ModuleAppCommerceModel: vi.fn(() => moduleAppCommerceMocks),
}));

vi.mock('../../module-apps/revenue', () => ({
  ModuleAppRevenueService: vi.fn(() => moduleAppRevenueMocks),
  ModuleAppOrderRevenueService: vi.fn(() => moduleAppOrderRevenueMocks),
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
const ORDER_ID = '00000000-0000-4000-8000-000000000021';
const PUBLISHER_ID = '00000000-0000-4000-8000-000000000051';
const PAYOUT_ID = '00000000-0000-4000-8000-000000000061';
const REVENUE_ID = '00000000-0000-4000-8000-000000000071';

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
    moduleAppOrderRevenueMocks.settleOrder.mockResolvedValue({ id: ORDER_ID, status: 'paid' });
    moduleAppOrderRevenueMocks.refundOrder.mockResolvedValue({ id: ORDER_ID, status: 'refunded' });
    mockAppEnv.MODULE_APP_ALIPAY_ENABLED = true;
    moduleAppPaymentMocks.refundOrder.mockResolvedValue({ id: ORDER_ID, status: 'refunded' });
    moduleAppPaymentMocks.reconcilePayment.mockResolvedValue({ status: 'paid' });
    moduleAppPaymentMocks.reconcilePendingPayments.mockResolvedValue({ count: 0, results: [] });
    moduleAppPaymentMocks.reconcileRefund.mockResolvedValue({ status: 'succeeded' });
    moduleAppPaymentModelMocks.acknowledgeDiscrepancy.mockResolvedValue({ status: 'resolved' });
    moduleAppPaymentModelMocks.listDiscrepancies.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppPublisherMocks.createPublisher.mockResolvedValue({ id: PUBLISHER_ID, status: 'pending' });
    moduleAppPublisherMocks.verifyPublisher.mockResolvedValue({ id: PUBLISHER_ID, status: 'verified' });
    moduleAppPublisherMocks.suspendPublisher.mockResolvedValue({
      id: PUBLISHER_ID,
      status: 'suspended',
    });
    moduleAppPublisherMocks.assignApplication.mockResolvedValue({
      id: APP_ID,
      publisherId: PUBLISHER_ID,
    });
    moduleAppPublisherMocks.listPublishers.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppPayoutMocks.createEligibleBatch.mockResolvedValue({
      id: PAYOUT_ID,
      status: 'eligible',
    });
    moduleAppPayoutMocks.transitionBatch.mockResolvedValue({ id: PAYOUT_ID, status: 'processing' });
    moduleAppPayoutMocks.recordManualAlipayPayout.mockResolvedValue({
      id: PAYOUT_ID,
      status: 'paid',
      transactionNo: 'alipay-txn-1',
    });
    moduleAppPayoutMocks.listPayouts.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listApplications.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listArtifacts.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listAuditEvents.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listInstalls.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listPackages.mockResolvedValue({
      items: [{ id: PACKAGE_ID }],
      nextCursor: null,
    });
    moduleAppReadModelMocks.listPaymentDiagnostics.mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    moduleAppReadModelMocks.listPayouts.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listPublishers.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listRecords.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listRevenue.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppReadModelMocks.listRuns.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppRevenueMocks.listRevenue.mockResolvedValue({ items: [], nextCursor: null });
    moduleAppRevenueMocks.settleBatchWithAudit.mockResolvedValue({
      batchId: '00000000-0000-4000-8000-000000000031',
      count: 2,
      settledAt: new Date('2026-07-11T00:00:00.000Z'),
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

    expect(moduleAppReadModelMocks.listPackages).toHaveBeenCalledWith({
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

  it('settles a module app order through finance permission and audits it', async () => {
    const caller = createCaller();
    await expect(
      caller.moduleApps.settleOrder({ orderId: ORDER_ID, paymentReference: 'manual:admin:1' }),
    ).resolves.toMatchObject({ status: 'paid' });

    expect(moduleAppOrderRevenueMocks.settleOrder).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      orderId: ORDER_ID,
      paymentReference: 'manual:admin:1',
    });
  });

  it('refunds a paid order with an actor and reason audit snapshot', async () => {
    const caller = createCaller();
    await expect(
      caller.moduleApps.refundOrder({ orderId: ORDER_ID, reason: 'customer_request' }),
    ).resolves.toMatchObject({ status: 'refunded' });

    expect(moduleAppOrderRevenueMocks.refundOrder).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      orderId: ORDER_ID,
      reason: 'customer_request',
    });
  });

  it('requests an Alipay refund through the provider payment service', async () => {
    const caller = createCaller();
    await expect(
      caller.moduleApps.refundPaymentOrder({ orderId: ORDER_ID, reason: 'customer_request' }),
    ).resolves.toMatchObject({ status: 'refunded' });
    expect(moduleAppPaymentMocks.refundOrder).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      orderId: ORDER_ID,
      reason: 'customer_request',
    });
  });

  it('runs bounded payment reconciliation operations through finance permission', async () => {
    const caller = createCaller();
    await expect(caller.moduleApps.retryPaymentQuery({ outTradeNo: 'out-1' })).resolves.toEqual({
      status: 'paid',
    });
    await expect(caller.moduleApps.reconcilePendingPayments({ limit: 25 })).resolves.toEqual({
      count: 0,
      results: [],
    });
    await expect(caller.moduleApps.retryRefundStatus({ orderId: ORDER_ID })).resolves.toEqual({
      status: 'succeeded',
    });
    expect(moduleAppPaymentMocks.reconcilePayment).toHaveBeenCalledWith({ outTradeNo: 'out-1' });
    expect(moduleAppPaymentMocks.reconcilePendingPayments).toHaveBeenCalledWith({ limit: 25 });
    expect(moduleAppPaymentMocks.reconcileRefund).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      orderId: ORDER_ID,
    });
  });

  it('acknowledges and exports bounded payment discrepancies', async () => {
    const caller = createCaller();
    const discrepancyId = '00000000-0000-4000-8000-000000000041';
    await expect(
      caller.moduleApps.acknowledgePaymentDiscrepancy({ discrepancyId }),
    ).resolves.toMatchObject({ status: 'resolved' });
    await expect(
      caller.moduleApps.exportPaymentReconciliation({ limit: 500, status: 'open' }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(moduleAppPaymentModelMocks.listDiscrepancies).toHaveBeenCalledWith({
      cursor: 0,
      limit: 500,
      status: 'open',
    });
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.payment_discrepancy_acknowledged',
        resourceId: discrepancyId,
      }),
    );
  });

  it('lists bounded module app revenue entries', async () => {
    const caller = createCaller();

    await expect(
      caller.moduleApps.listRevenue({ limit: 25, publisherUserId: 'publisher-1', status: 'pending' }),
    ).resolves.toEqual({ items: [], nextCursor: null });

    expect(moduleAppReadModelMocks.listRevenue).toHaveBeenCalledWith({
      cursor: 0,
      limit: 25,
      publisherUserId: 'publisher-1',
      status: 'pending',
    });
  });

  it('settles a revenue batch through finance permission with an audit snapshot', async () => {
    const caller = createCaller();
    const entryIds = [
      '00000000-0000-4000-8000-000000000041',
      '00000000-0000-4000-8000-000000000042',
    ];

    await expect(caller.moduleApps.settleRevenueBatch({ entryIds })).resolves.toMatchObject({
      batchId: '00000000-0000-4000-8000-000000000031',
      count: 2,
    });

    expect(moduleAppRevenueMocks.settleBatchWithAudit).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      entryIds,
    });
  });

  it('manages stable publisher ownership through admin procedures and audits mutations', async () => {
    const caller = createCaller();

    await caller.moduleApps.createPublisher({
      displayName: 'Verified Studio',
      recipientMask: 'ali***@example.com',
      userId: 'publisher-user',
    });
    await caller.moduleApps.verifyPublisher({
      publisherId: PUBLISHER_ID,
      verificationMetadata: { ticket: 'review-1' },
    });
    await caller.moduleApps.assignPublisher({ appId: APP_ID, publisherId: PUBLISHER_ID });
    await caller.moduleApps.suspendPublisher({ publisherId: PUBLISHER_ID });
    await expect(caller.moduleApps.listPublishers({ limit: 25, status: 'verified' })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(moduleAppReadModelMocks.listPublishers).toHaveBeenCalledWith({
      cursor: 0,
      limit: 25,
      status: 'verified',
    });

    expect(moduleAppPublisherMocks.assignApplication).toHaveBeenCalledWith({
      appId: APP_ID,
      publisherId: PUBLISHER_ID,
    });
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.publisher_suspended',
        resourceId: PUBLISHER_ID,
        resourceType: 'moduleAppPublisher',
      }),
    );
  });

  it('creates, transitions, and records manual Alipay payouts with audit evidence', async () => {
    const caller = createCaller();

    await caller.moduleApps.createPayoutBatch({
      publisherId: PUBLISHER_ID,
      requestedAmount: 80,
      revenueEntryIds: [REVENUE_ID],
    });
    await caller.moduleApps.transitionPayoutBatch({
      batchId: PAYOUT_ID,
      status: 'processing',
    });
    await caller.moduleApps.recordManualAlipayPayout({
      batchId: PAYOUT_ID,
      evidenceReference: 's3://evidence/payout-1.pdf',
      recipientMask: 'ali***@example.com',
      transactionNo: 'alipay-txn-1',
    });
    await expect(
      caller.moduleApps.listPayouts({ publisherId: PUBLISHER_ID, status: 'paid' }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(moduleAppReadModelMocks.listPayouts).toHaveBeenCalledWith({
      cursor: 0,
      limit: 50,
      publisherId: PUBLISHER_ID,
      status: 'paid',
    });

    expect(moduleAppPayoutMocks.recordManualAlipayPayout).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      batchId: PAYOUT_ID,
      evidenceReference: 's3://evidence/payout-1.pdf',
      recipientMask: 'ali***@example.com',
      transactionNo: 'alipay-txn-1',
    });
    expect(writeModuleAppAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'module_app.payout_paid',
        resourceId: PAYOUT_ID,
        resourceType: 'moduleAppPayout',
      }),
    );
  });

  it('lists stable-cursor application and payment diagnostics with server filters', async () => {
    const caller = createCaller();
    const cursor = Buffer.from('cursor').toString('base64url');

    await caller.moduleApps.list({ cursor, publisherId: PUBLISHER_ID, status: 'published' });
    await caller.moduleApps.listPaymentDiagnostics({
      appId: APP_ID,
      discrepancyStatus: 'open',
      paymentStatus: 'paid',
      refundStatus: 'succeeded',
    });

    expect(moduleAppReadModelMocks.listApplications).toHaveBeenCalledWith({
      cursor,
      limit: 50,
      publisherId: PUBLISHER_ID,
      status: 'published',
    });
    expect(moduleAppReadModelMocks.listPaymentDiagnostics).toHaveBeenCalledWith({
      appId: APP_ID,
      cursor: 0,
      discrepancyStatus: 'open',
      limit: 50,
      paymentStatus: 'paid',
      refundStatus: 'succeeded',
    });
  });
});
