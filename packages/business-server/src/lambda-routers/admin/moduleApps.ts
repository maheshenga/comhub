import {
  moduleAppAdminUpsertSchema,
  moduleAppBillingConfigSchema,
  moduleAppPackageReviewStatusSchema,
  moduleAppPayoutStatusSchema,
  moduleAppPlanEntitlementSchema,
  moduleAppPublisherStatusSchema,
  moduleAppStatusSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ModuleAppModel } from '@/database/models/moduleApp';
import { ModuleAppPaymentModel } from '@/database/models/moduleAppPayment';
import { ModuleAppPayoutModel } from '@/database/models/moduleAppPayout';
import { ModuleAppPublisherModel } from '@/database/models/moduleAppPublisher';
import type { LobeChatDatabase } from '@/database/type';
import { appEnv } from '@/envs/app';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import { ModuleAppBuildService } from '@/server/services/moduleAppBuild/service';
import { ModuleAppPackageLifecycleService } from '@/server/services/moduleAppPackage/lifecycle';
import { createConfiguredModuleAppAlipayClient } from '@/server/services/moduleAppPayments/alipay/client';

import { writeModuleAppAuditLog } from '../../module-apps/audit';
import { ModuleAppPaymentService } from '../../module-apps/payments/service';
import { ModuleAppOrderRevenueService, ModuleAppRevenueService } from '../../module-apps/revenue';
import { ModuleAppAdminReadModel } from './moduleApps.readModels';

const auditReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.auditRead);
const contentWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.contentWrite);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

const AppIdInputSchema = z.object({ appId: z.string().uuid() });
const PackageIdInputSchema = z.object({ packageId: z.string().uuid() });
const AdminCursorSchema = z.union([z.number().int().min(0), z.string().min(1).max(512)]).default(0);
const ListInputSchema = z
  .object({
    appId: z.string().uuid().optional(),
    category: z.string().min(1).max(80).optional(),
    cursor: AdminCursorSchema,
    limit: z.number().int().min(1).max(200).default(50),
    publisherId: z.string().uuid().optional(),
    status: moduleAppStatusSchema.optional(),
  })
  .optional()
  .default({});
const ListByAppInputSchema = AppIdInputSchema.extend({
  cursor: AdminCursorSchema,
  limit: z.number().int().min(1).max(200).default(50),
});
const ListPackagesInputSchema = z
  .object({
    appId: z.string().uuid().optional(),
    buildStatus: z.enum(['building', 'failed', 'queued', 'ready']).optional(),
    cursor: AdminCursorSchema,
    limit: z.number().int().min(1).max(200).default(50),
    publisherId: z.string().uuid().optional(),
    reviewStatus: moduleAppPackageReviewStatusSchema.optional(),
    submittedByUserId: z.string().min(1).max(255).optional(),
  })
  .optional()
  .default({});
const RejectPackageInputSchema = PackageIdInputSchema.extend({
  reason: z.string().min(1).max(1000).optional(),
});
const OrderIdInputSchema = z.object({ orderId: z.string().uuid() });
const SettleOrderInputSchema = OrderIdInputSchema.extend({
  paymentReference: z.string().min(1).max(240),
});
const RefundOrderInputSchema = OrderIdInputSchema.extend({
  reason: z.string().min(1).max(1000),
});
const PaymentQueryInputSchema = z.object({ outTradeNo: z.string().min(1).max(240) });
const ReconcilePendingInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
});
const PaymentDiscrepancyListInputSchema = z
  .object({
    cursor: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(500).default(50),
    status: z.enum(['open', 'resolved']).optional(),
  })
  .optional()
  .default({});
const PaymentDiscrepancyIdInputSchema = z.object({ discrepancyId: z.string().uuid() });
const ListRevenueInputSchema = z
  .object({
    appId: z.string().uuid().optional(),
    cursor: AdminCursorSchema,
    limit: z.number().int().min(1).max(200).default(50),
    publisherId: z.string().uuid().optional(),
    publisherUserId: z.string().min(1).max(255).optional(),
    status: z.enum(['pending', 'reversed', 'settled']).optional(),
  })
  .optional()
  .default({});
const SettleRevenueBatchInputSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(500),
});
const PublisherIdInputSchema = z.object({ publisherId: z.string().uuid() });
const CreatePublisherInputSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  recipientMask: z.string().trim().min(3).max(200).refine((value) => value.includes('*')).optional(),
  userId: z.string().trim().min(1).max(255),
});
const VerifyPublisherInputSchema = PublisherIdInputSchema.extend({
  verificationMetadata: z
    .record(z.string().max(80), z.unknown())
    .refine((value) => Object.keys(value).length <= 50)
    .optional(),
});
const AssignPublisherInputSchema = AppIdInputSchema.extend({
  publisherId: z.string().uuid(),
});
const ListPublishersInputSchema = z
  .object({
    cursor: AdminCursorSchema,
    limit: z.number().int().min(1).max(200).default(50),
    status: moduleAppPublisherStatusSchema.optional(),
    userId: z.string().trim().min(1).max(255).optional(),
  })
  .optional()
  .default({});
const CreatePayoutBatchInputSchema = PublisherIdInputSchema.extend({
  requestedAmount: z.number().finite().positive().max(1_000_000_000_000),
  revenueEntryIds: z.array(z.string().uuid()).min(1).max(500),
});
const PayoutBatchIdInputSchema = z.object({ batchId: z.string().uuid() });
const TransitionPayoutBatchInputSchema = PayoutBatchIdInputSchema.extend({
  failureReason: z.string().trim().min(1).max(1000).optional(),
  status: moduleAppPayoutStatusSchema.exclude(['paid']),
});
const RecordManualAlipayPayoutInputSchema = PayoutBatchIdInputSchema.extend({
  evidenceReference: z.string().trim().min(1).max(1000),
  recipientMask: z.string().trim().min(3).max(200).refine((value) => value.includes('*')),
  transactionNo: z.string().trim().min(1).max(240),
});
const ListPayoutsInputSchema = z
  .object({
    cursor: AdminCursorSchema,
    limit: z.number().int().min(1).max(200).default(50),
    publisherId: z.string().uuid().optional(),
    status: moduleAppPayoutStatusSchema.optional(),
  })
  .optional()
  .default({});
const ListPaymentDiagnosticsInputSchema = z
  .object({
    appId: z.string().uuid().optional(),
    cursor: AdminCursorSchema,
    discrepancyStatus: z.enum(['open', 'resolved']).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    orderId: z.string().uuid().optional(),
    paymentStatus: z.enum(['created', 'failed', 'paid', 'pending', 'refunded']).optional(),
    refundStatus: z.enum(['failed', 'requested', 'succeeded']).optional(),
  })
  .optional()
  .default({});

const PagesInputSchema = z.object({
  appId: z.string().uuid(),
  pages: moduleAppAdminUpsertSchema.shape.pages,
});

const ActionsInputSchema = z.object({
  actions: moduleAppAdminUpsertSchema.shape.actions,
  appId: z.string().uuid(),
});

const BillingInputSchema = z.object({
  appId: z.string().uuid(),
  billing: moduleAppBillingConfigSchema,
});

const EntitlementsInputSchema = z.object({
  appId: z.string().uuid(),
  entitlements: z.array(moduleAppPlanEntitlementSchema).max(100),
});

const writeAudit = async (
  ctx: { serverDB: LobeChatDatabase; userId: string },
  input: {
    eventType: string;
    metadata?: null | Record<string, unknown>;
    resourceId: string;
    resourceType?: string;
  },
) => {
  await writeModuleAppAuditLog({
    actorUserId: ctx.userId,
    db: ctx.serverDB,
    eventType: input.eventType,
    metadata: input.metadata,
    resourceId: input.resourceId,
    resourceType: input.resourceType ?? 'moduleApp',
  });
};

const requireAdminApp = async (db: LobeChatDatabase, appId: string) => {
  const app = await new ModuleAppModel(db).getAdminApp({ appId });

  if (!app) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_not_found' });
  }

  return app;
};

const getPackageErrorIdentifier = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return error instanceof Error ? error.message : '';
};

const mapPackageReviewError = (error: unknown) => {
  if (error instanceof TRPCError) return error;

  const identifier = getPackageErrorIdentifier(error);
  if (identifier === 'MODULE_APP_PACKAGE_SCAN_NOT_CLEAN') {
    return new TRPCError({ cause: error, code: 'PRECONDITION_FAILED', message: identifier });
  }
  if (identifier === 'MODULE_APP_PACKAGE_NOT_FOUND') {
    return new TRPCError({ cause: error, code: 'NOT_FOUND', message: identifier });
  }
  if (
    identifier === 'MODULE_APP_PACKAGE_NOT_PENDING_REVIEW' ||
    identifier.startsWith('MODULE_APP_PACKAGE_RESCAN_')
  ) {
    return new TRPCError({ cause: error, code: 'BAD_REQUEST', message: identifier });
  }

  return new TRPCError({
    cause: error,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'module_app_package_review_failed',
  });
};

const mapPublishError = (error: unknown) => {
  const identifier = getPackageErrorIdentifier(error);
  if (identifier === 'MODULE_APP_BUILD_NOT_READY') {
    return new TRPCError({ cause: error, code: 'PRECONDITION_FAILED', message: identifier });
  }

  return error;
};

export const adminModuleAppsRouter = router({
  assignPublisher: contentWriteProcedure
    .input(AssignPublisherInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPublisherModel(ctx.serverDB).assignApplication(input);
      await writeAudit(ctx, {
        eventType: 'module_app.publisher_assigned',
        metadata: { appId: input.appId },
        resourceId: input.publisherId,
        resourceType: 'moduleAppPublisher',
      });
      return result;
    }),

  acknowledgePaymentDiscrepancy: financeWriteProcedure
    .input(PaymentDiscrepancyIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPaymentModel(ctx.serverDB).acknowledgeDiscrepancy(input);
      await writeAudit(ctx, {
        eventType: 'module_app.payment_discrepancy_acknowledged',
        resourceId: input.discrepancyId,
        resourceType: 'moduleAppPaymentDiscrepancy',
      });
      return result;
    }),

  createPayoutBatch: financeWriteProcedure
    .input(CreatePayoutBatchInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPayoutModel(ctx.serverDB).createEligibleBatch(input);
      await writeAudit(ctx, {
        eventType: 'module_app.payout_created',
        metadata: {
          publisherId: input.publisherId,
          requestedAmount: input.requestedAmount,
          revenueEntryIds: input.revenueEntryIds,
        },
        resourceId: result.id,
        resourceType: 'moduleAppPayout',
      });
      return result;
    }),

  createPublisher: contentWriteProcedure
    .input(CreatePublisherInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPublisherModel(ctx.serverDB).createPublisher(input);
      await writeAudit(ctx, {
        eventType: 'module_app.publisher_created',
        metadata: { userId: input.userId },
        resourceId: result.id,
        resourceType: 'moduleAppPublisher',
      });
      return result;
    }),

  exportPaymentReconciliation: auditReadProcedure
    .input(PaymentDiscrepancyListInputSchema)
    .query(async ({ ctx, input }) =>
      new ModuleAppPaymentModel(ctx.serverDB).listDiscrepancies({
        ...input,
        limit: Math.min(500, input.limit),
      }),
    ),

  get: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return requireAdminApp(ctx.serverDB, input.appId);
  }),

  list: auditReadProcedure.input(ListInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppAdminReadModel(ctx.serverDB).listApplications(input);
  }),

  listPayouts: auditReadProcedure.input(ListPayoutsInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppAdminReadModel(ctx.serverDB).listPayouts(input);
  }),

  listPaymentDiagnostics: auditReadProcedure
    .input(ListPaymentDiagnosticsInputSchema)
    .query(async ({ ctx, input }) => {
      return new ModuleAppAdminReadModel(ctx.serverDB).listPaymentDiagnostics(input);
    }),

  listPublishers: auditReadProcedure
    .input(ListPublishersInputSchema)
    .query(async ({ ctx, input }) => {
      return new ModuleAppAdminReadModel(ctx.serverDB).listPublishers(input);
    }),

  listRevenue: auditReadProcedure.input(ListRevenueInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppAdminReadModel(ctx.serverDB).listRevenue(input);
  }),

  reconcilePendingPayments: financeWriteProcedure
    .input(ReconcilePendingInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!appEnv.MODULE_APP_ALIPAY_ENABLED) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'module_app_alipay_disabled' });
      }
      return new ModuleAppPaymentService(
        ctx.serverDB,
        createConfiguredModuleAppAlipayClient(),
      ).reconcilePendingPayments(input);
    }),

  recordManualAlipayPayout: financeWriteProcedure
    .input(RecordManualAlipayPayoutInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPayoutModel(ctx.serverDB).recordManualAlipayPayout({
        actorUserId: ctx.userId,
        ...input,
      });
      await writeAudit(ctx, {
        eventType: 'module_app.payout_paid',
        metadata: {
          evidenceReference: input.evidenceReference,
          recipientMask: input.recipientMask,
          totalAmount: result.totalAmount,
          transactionNo: input.transactionNo,
        },
        resourceId: input.batchId,
        resourceType: 'moduleAppPayout',
      });
      return result;
    }),

  refundOrder: financeWriteProcedure.input(RefundOrderInputSchema).mutation(async ({ ctx, input }) => {
    return new ModuleAppOrderRevenueService(ctx.serverDB).refundOrder({
      actorUserId: ctx.userId,
      orderId: input.orderId,
      reason: input.reason,
    });
  }),

  refundPaymentOrder: financeWriteProcedure
    .input(RefundOrderInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!appEnv.MODULE_APP_ALIPAY_ENABLED) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_alipay_disabled',
        });
      }
      return new ModuleAppPaymentService(
        ctx.serverDB,
        createConfiguredModuleAppAlipayClient(),
      ).refundOrder({
        actorUserId: ctx.userId,
        orderId: input.orderId,
        reason: input.reason,
      });
    }),

  retryPaymentQuery: financeWriteProcedure
    .input(PaymentQueryInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!appEnv.MODULE_APP_ALIPAY_ENABLED) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'module_app_alipay_disabled' });
      }
      return new ModuleAppPaymentService(
        ctx.serverDB,
        createConfiguredModuleAppAlipayClient(),
      ).reconcilePayment(input);
    }),

  retryRefundStatus: financeWriteProcedure
    .input(OrderIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!appEnv.MODULE_APP_ALIPAY_ENABLED) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'module_app_alipay_disabled' });
      }
      return new ModuleAppPaymentService(
        ctx.serverDB,
        createConfiguredModuleAppAlipayClient(),
      ).reconcileRefund({ actorUserId: ctx.userId, orderId: input.orderId });
    }),

  settleOrder: financeWriteProcedure.input(SettleOrderInputSchema).mutation(async ({ ctx, input }) => {
    return new ModuleAppOrderRevenueService(ctx.serverDB).settleOrder({
      actorUserId: ctx.userId,
      ...input,
    });
  }),

  settleRevenueBatch: financeWriteProcedure
    .input(SettleRevenueBatchInputSchema)
    .mutation(async ({ ctx, input }) => {
      return new ModuleAppRevenueService(ctx.serverDB).settleBatchWithAudit({
        actorUserId: ctx.userId,
        entryIds: input.entryIds,
      });
    }),

  suspendPublisher: contentWriteProcedure
    .input(PublisherIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPublisherModel(ctx.serverDB).suspendPublisher(input);
      await writeAudit(ctx, {
        eventType: 'module_app.publisher_suspended',
        resourceId: input.publisherId,
        resourceType: 'moduleAppPublisher',
      });
      return result;
    }),

  transitionPayoutBatch: financeWriteProcedure
    .input(TransitionPayoutBatchInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPayoutModel(ctx.serverDB).transitionBatch(input);
      await writeAudit(ctx, {
        eventType: `module_app.payout_${input.status}`,
        metadata: { failureReason: input.failureReason },
        resourceId: input.batchId,
        resourceType: 'moduleAppPayout',
      });
      return result;
    }),

  getPackage: auditReadProcedure.input(PackageIdInputSchema).query(async ({ ctx, input }) => {
    const submission = await new ModuleAppModel(ctx.serverDB).getAdminPackageSubmission(input);

    if (!submission) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_package_not_found' });
    }

    return submission;
  }),

  listArtifacts: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppAdminReadModel(ctx.serverDB).listArtifacts(input);
  }),

  listAuditEvents: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppAdminReadModel(ctx.serverDB).listAuditEvents(input);
  }),

  listPackages: auditReadProcedure.input(ListPackagesInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppAdminReadModel(ctx.serverDB).listPackages(input);
  }),

  listInstalls: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppAdminReadModel(ctx.serverDB).listInstalls(input);
  }),

  listRecords: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppAdminReadModel(ctx.serverDB).listRecords(input);
  }),

  listRuns: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppAdminReadModel(ctx.serverDB).listRuns(input);
  }),

  publish: contentWriteProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    try {
      await new ModuleAppModel(ctx.serverDB).setStatus({ appId: input.appId, status: 'published' });
    } catch (error) {
      throw mapPublishError(error);
    }
    await writeAudit(ctx, { eventType: 'module_app.published', resourceId: input.appId });

    return { ok: true };
  }),

  approvePackage: contentWriteProcedure
    .input(PackageIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      let result;
      try {
        result = await new ModuleAppBuildService({ db: ctx.serverDB }).approvePackage({
          ...input,
          reviewedByUserId: ctx.userId,
        });
      } catch (error) {
        throw mapPackageReviewError(error);
      }

      await writeAudit(ctx, {
        eventType: 'module_app.package_approved',
        metadata: {
          buildId: result.build?.id,
          buildStatus: result.build?.status,
          packageId: input.packageId,
          slug: result.slug,
          versionId: result.versionId,
        },
        resourceId: result.appId,
      });

      return result;
    }),

  rescanPackage: contentWriteProcedure
    .input(PackageIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      let result;
      try {
        result = await new ModuleAppPackageLifecycleService({
          db: ctx.serverDB,
        }).rescanLegacyPackage({
          ...input,
          reviewedByUserId: ctx.userId,
        });
      } catch (error) {
        throw mapPackageReviewError(error);
      }

      await writeAudit(ctx, {
        eventType: 'module_app.package_rescanned',
        metadata: {
          cleanupQueued: result.cleanupQueued,
          issueCodes: result.issueCodes,
          scanStatus: result.scanStatus,
        },
        resourceId: input.packageId,
        resourceType: 'moduleAppPackage',
      });

      return result;
    }),

  rejectPackage: contentWriteProcedure
    .input(RejectPackageInputSchema)
    .mutation(async ({ ctx, input }) => {
      let result;
      try {
        result = await new ModuleAppPackageLifecycleService({
          db: ctx.serverDB,
        }).releaseRejectedPackage({
          ...input,
          reviewedByUserId: ctx.userId,
        });
      } catch (error) {
        throw mapPackageReviewError(error);
      }

      await writeAudit(ctx, {
        eventType: 'module_app.package_rejected',
        metadata: {
          cleanupQueued: result.cleanupQueued,
          cleanupSkipped: 'cleanupSkipped' in result ? result.cleanupSkipped : false,
          reason: input.reason,
        },
        resourceId: input.packageId,
        resourceType: 'moduleAppPackage',
      });

      return result;
    }),

  unpublish: contentWriteProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    await new ModuleAppModel(ctx.serverDB).setStatus({ appId: input.appId, status: 'unpublished' });
    await writeAudit(ctx, { eventType: 'module_app.unpublished', resourceId: input.appId });

    return { ok: true };
  }),

  upsert: contentWriteProcedure.input(moduleAppAdminUpsertSchema).mutation(async ({ ctx, input }) => {
    const result = await new ModuleAppModel(ctx.serverDB).upsertAppForAdmin(input);

    await writeAudit(ctx, {
      eventType: 'module_app.upserted',
      metadata: { slug: input.slug, status: input.status },
      resourceId: result.id,
    });

    return result;
  }),

  upsertActions: contentWriteProcedure.input(ActionsInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    const result = await new ModuleAppModel(ctx.serverDB).upsertActionsForAdmin(input);
    await writeAudit(ctx, {
      eventType: 'module_app.actions_upserted',
      metadata: { count: input.actions.length },
      resourceId: input.appId,
    });

    return result;
  }),

  upsertBilling: financeWriteProcedure.input(BillingInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    const result = await new ModuleAppModel(ctx.serverDB).upsertBillingForAdmin(input);
    await writeAudit(ctx, {
      eventType: 'module_app.billing_upserted',
      metadata: { chargeMode: input.billing.chargeMode },
      resourceId: input.appId,
    });

    return result;
  }),

  upsertEntitlements: financeWriteProcedure
    .input(EntitlementsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireAdminApp(ctx.serverDB, input.appId);

      const result = await new ModuleAppModel(ctx.serverDB).upsertEntitlementsForAdmin(input);
      await writeAudit(ctx, {
        eventType: 'module_app.entitlements_upserted',
        metadata: { count: input.entitlements.length },
        resourceId: input.appId,
      });

      return result;
    }),

  upsertPages: contentWriteProcedure.input(PagesInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    const result = await new ModuleAppModel(ctx.serverDB).upsertPagesForAdmin(input);
    await writeAudit(ctx, {
      eventType: 'module_app.pages_upserted',
      metadata: { count: input.pages.length },
      resourceId: input.appId,
    });

    return result;
  }),

  verifyPublisher: contentWriteProcedure
    .input(VerifyPublisherInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppPublisherModel(ctx.serverDB).verifyPublisher(input);
      await writeAudit(ctx, {
        eventType: 'module_app.publisher_verified',
        resourceId: input.publisherId,
        resourceType: 'moduleAppPublisher',
      });
      return result;
    }),
});
