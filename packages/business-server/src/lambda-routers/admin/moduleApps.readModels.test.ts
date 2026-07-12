// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import {
  moduleAppAuditLogs,
  moduleAppBuilds,
  moduleAppLicenses,
  moduleAppOrders,
  moduleAppPackages,
  moduleAppPaymentAttempts,
  moduleAppPaymentDiscrepancies,
  moduleAppPaymentEvents,
  moduleAppPaymentRefunds,
  moduleAppPayoutBatches,
  moduleAppPayoutEntries,
  moduleAppPrices,
  moduleAppProducts,
  moduleAppPublishers,
  moduleAppRevenueEntries,
  moduleAppRuns,
  moduleApps,
  moduleAppVersions,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { ModuleAppAdminReadModel } from './moduleApps.readModels';

const db: LobeChatDatabase = await getTestDB();
const PUBLISHER_USER_ID = 'module-app-read-model-publisher';
const PURCHASER_USER_ID = 'module-app-read-model-purchaser';

beforeEach(async () => {
  await db.delete(moduleAppAuditLogs);
  await db.delete(moduleAppPayoutEntries);
  await db.delete(moduleAppPayoutBatches);
  await db.delete(moduleAppPaymentDiscrepancies);
  await db.delete(moduleAppPaymentRefunds);
  await db.delete(moduleAppPaymentEvents);
  await db.delete(moduleAppPaymentAttempts);
  await db.delete(moduleAppRevenueEntries);
  await db.delete(moduleAppLicenses);
  await db.delete(moduleAppRuns);
  await db.delete(moduleAppOrders);
  await db.delete(moduleAppPrices);
  await db.delete(moduleAppProducts);
  await db.delete(moduleAppBuilds);
  await db.delete(moduleAppPackages);
  await db.delete(moduleAppVersions);
  await db.delete(moduleApps);
  await db.delete(moduleAppPublishers);
  await db.delete(users);
  await db.insert(users).values([{ id: PUBLISHER_USER_ID }, { id: PURCHASER_USER_ID }]);
});

const seedApplications = async () => {
  const [publisher] = await db
    .insert(moduleAppPublishers)
    .values({
      displayName: 'Read Model Studio',
      recipientMask: 'ali***@example.com',
      status: 'verified',
      userId: PUBLISHER_USER_ID,
    })
    .returning();
  const apps = await db
    .insert(moduleApps)
    .values(
      Array.from({ length: 5 }, (_, index) => ({
        appType: 'standard_app' as const,
        category: index % 2 === 0 ? 'commerce' : 'productivity',
        description: `Read model app ${index}`,
        displayName: `App ${index}`,
        icon: 'Box',
        publisherId: publisher.id,
        slug: `read-model-app-${index}`,
        sortOrder: index,
        status: index === 4 ? ('unpublished' as const) : ('published' as const),
      })),
    )
    .returning();
  return { apps, publisher };
};

describe('ModuleAppAdminReadModel', () => {
  it('uses stable keyset cursors across a dataset larger than one page', async () => {
    const { apps, publisher } = await seedApplications();
    const model = new ModuleAppAdminReadModel(db);

    const first = await model.listApplications({ limit: 2, publisherId: publisher.id });
    const second = await model.listApplications({
      cursor: first.nextCursor!,
      limit: 2,
      publisherId: publisher.id,
    });
    const third = await model.listApplications({
      cursor: second.nextCursor!,
      limit: 2,
      publisherId: publisher.id,
    });

    expect(first.items.map((item) => item.displayName)).toEqual(['App 0', 'App 1']);
    expect(second.items.map((item) => item.displayName)).toEqual(['App 2', 'App 3']);
    expect(third.items.map((item) => item.displayName)).toEqual(['App 4']);
    expect(
      new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size,
    ).toBe(5);
    expect(third.nextCursor).toBeNull();

    await expect(model.listPublishers({ limit: 10, status: 'verified' })).resolves.toMatchObject({
      items: [{ appCount: 5, id: publisher.id }],
    });

    await db.insert(moduleAppRuns).values(
      Array.from({ length: 3 }, () => ({
        appId: apps[0].id,
        scopeType: 'personal' as const,
        status: 'succeeded' as const,
        userId: PURCHASER_USER_ID,
      })),
    );
    const runPage = await model.listRuns({ appId: apps[0].id, limit: 2 });
    const remainingRuns = await model.listRuns({
      appId: apps[0].id,
      cursor: runPage.nextCursor!,
      limit: 2,
    });
    expect(runPage.items).toHaveLength(2);
    expect(remainingRuns.items).toHaveLength(1);
    expect(
      new Set([...runPage.items, ...remainingRuns.items].map((item) => item.id)).size,
    ).toBe(3);
  });

  it('filters packages by publisher and build status', async () => {
    const { apps, publisher } = await seedApplications();
    const [version] = await db
      .insert(moduleAppVersions)
      .values({ appId: apps[0].id, version: '1.0.0' })
      .returning();
    const [packageRow] = await db
      .insert(moduleAppPackages)
      .values({
        appId: apps[0].id,
        archive: {
          fileName: 'read-model.zip',
          mimeType: 'application/zip',
          sha256: 'a'.repeat(64),
          sizeBytes: 100,
          storageKey: 'module-app-packages/read-model.zip',
        },
        manifestSnapshot: { packageVersion: '1.0.0' } as never,
        publisherId: publisher.id,
        reviewStatus: 'approved',
        submittedByUserId: PUBLISHER_USER_ID,
        versionId: version.id,
      })
      .returning();
    await db.insert(moduleAppBuilds).values({
      artifactKey: 'module-app-builds/read-model.tgz',
      artifactSha256: 'b'.repeat(64),
      buildProfile: 'node22-static',
      packageId: packageRow.id,
      sourceSha256: 'a'.repeat(64),
      status: 'ready',
      versionId: version.id,
    });

    await expect(
      new ModuleAppAdminReadModel(db).listPackages({
        buildStatus: 'ready',
        publisherId: publisher.id,
      }),
    ).resolves.toMatchObject({
      items: [{ buildStatus: 'ready', id: packageRow.id, publisherId: publisher.id }],
    });
  });

  it('returns safe linked payment and payout identifiers with server-side filters', async () => {
    const { apps, publisher } = await seedApplications();
    const [product] = await db
      .insert(moduleAppProducts)
      .values({
        appId: apps[0].id,
        licenseScope: 'personal',
        productKey: 'read-model-product',
        productType: 'one_time',
      })
      .returning();
    const [price] = await db
      .insert(moduleAppPrices)
      .values({ amount: 88, currency: 'CNY', productId: product.id })
      .returning();
    const [order] = await db
      .insert(moduleAppOrders)
      .values({
        appId: apps[0].id,
        paidAt: new Date(),
        priceId: price.id,
        productId: product.id,
        purchaserUserId: PURCHASER_USER_ID,
        snapshot: { currency: 'CNY', price: 88 },
        status: 'paid',
      })
      .returning();
    const [attempt] = await db
      .insert(moduleAppPaymentAttempts)
      .values({
        currency: 'CNY',
        notifyUrl: 'https://example.com/notify',
        orderId: order.id,
        outTradeNo: 'read-model-out-1',
        provider: 'alipay',
        returnUrl: 'https://example.com/return',
        status: 'paid',
        subject: 'Read model payment',
        totalAmount: '88.000000',
      })
      .returning();
    const [event] = await db
      .insert(moduleAppPaymentEvents)
      .values({
        currency: 'CNY',
        eventStatus: 'processed',
        eventType: 'payment_succeeded',
        metadata: { sign: 'must-not-be-returned' },
        occurredAt: new Date(),
        orderId: order.id,
        outTradeNo: attempt.outTradeNo,
        provider: 'alipay',
        providerEventId: 'read-model-event-1',
        totalAmount: '88.000000',
      })
      .returning();
    const [refund] = await db
      .insert(moduleAppPaymentRefunds)
      .values({
        currency: 'CNY',
        orderId: order.id,
        provider: 'alipay',
        providerRefundId: 'read-model-refund-1',
        reason: 'test',
        refundAmount: '88.000000',
        status: 'succeeded',
      })
      .returning();
    const [discrepancy] = await db
      .insert(moduleAppPaymentDiscrepancies)
      .values({
        discrepancyKey: 'read-model-discrepancy-1',
        kind: 'refund_mismatch',
        orderId: order.id,
        outTradeNo: attempt.outTradeNo,
        provider: 'alipay',
        status: 'open',
      })
      .returning();
    const [license] = await db
      .insert(moduleAppLicenses)
      .values({
        appId: apps[0].id,
        licenseScope: 'personal',
        orderId: order.id,
        ownerUserId: PURCHASER_USER_ID,
      })
      .returning();
    const [revenue] = await db
      .insert(moduleAppRevenueEntries)
      .values({
        appId: apps[0].id,
        currency: 'CNY',
        developerAmount: 70,
        grossAmount: 88,
        orderId: order.id,
        platformFee: 18,
        publisherId: publisher.id,
        publisherUserId: PUBLISHER_USER_ID,
        reserveAmount: 0,
        status: 'settled',
        type: 'accrual',
      })
      .returning();
    const [payout] = await db
      .insert(moduleAppPayoutBatches)
      .values({
        currency: 'CNY',
        publisherId: publisher.id,
        recipientMask: 'ali***@example.com',
        status: 'paid',
        totalAmount: 70,
        transactionNo: 'read-model-alipay-1',
      })
      .returning();
    await db.insert(moduleAppPayoutEntries).values({
      amount: 70,
      batchId: payout.id,
      revenueEntryId: revenue.id,
      status: 'paid',
    });
    const [run] = await db
      .insert(moduleAppRuns)
      .values({
        appId: apps[0].id,
        scopeType: 'personal',
        status: 'succeeded',
        userId: PURCHASER_USER_ID,
      })
      .returning();
    const auditRows = await db
      .insert(moduleAppAuditLogs)
      .values([
        {
          eventType: 'module_app.order_settled',
          resourceId: order.id,
          resourceType: 'moduleAppOrder',
        },
        {
          eventType: 'module_app.payout_paid',
          resourceId: payout.id,
          resourceType: 'moduleAppPayout',
        },
      ])
      .returning();

    const model = new ModuleAppAdminReadModel(db);
    const payments = await model.listPaymentDiagnostics({
      appId: apps[0].id,
      discrepancyStatus: 'open',
      paymentStatus: 'paid',
      refundStatus: 'succeeded',
    });
    expect(payments.items[0]).toMatchObject({
      auditEventIds: [auditRows[0].id],
      discrepancyIds: [discrepancy.id],
      licenseIds: [license.id],
      orderId: order.id,
      paymentEventIds: [event.id],
      payoutBatchIds: [payout.id],
      refundIds: [refund.id],
      revenueEntryIds: [revenue.id],
      latestAppRuntimeInvocationId: run.id,
    });
    expect(payments.items[0]).not.toHaveProperty('metadata');

    await expect(
      model.listPayouts({ publisherId: publisher.id, status: 'paid' }),
    ).resolves.toMatchObject({
      items: [
        {
          auditEventIds: [auditRows[1].id],
          id: payout.id,
          revenueEntryIds: [revenue.id],
        },
      ],
    });
  });
});
