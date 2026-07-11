import { and, eq } from 'drizzle-orm';

import {
  moduleAppInstallations,
  moduleAppSchedules,
  moduleAppVersions,
  moduleAppWebhookDeliveries,
  moduleAppWebhooks,
} from '../schemas';
import type { LobeChatDatabase } from '../type';

export class ModuleAppTriggerModel {
  constructor(private readonly db: LobeChatDatabase) {}

  getWebhookContext = async (webhookId: string) => {
    const [row] = await this.db
      .select({
        installationId: moduleAppWebhooks.installationId,
        replayWindowSeconds: moduleAppWebhooks.replayWindowSeconds,
        runtimeManifest: moduleAppVersions.runtimeManifest,
        secretHash: moduleAppWebhooks.secretHash,
        status: moduleAppWebhooks.status,
        webhookId: moduleAppWebhooks.id,
        workflowKey: moduleAppWebhooks.workflowKey,
        workflowVersion: moduleAppWebhooks.workflowVersion,
      })
      .from(moduleAppWebhooks)
      .innerJoin(
        moduleAppInstallations,
        eq(moduleAppInstallations.id, moduleAppWebhooks.installationId),
      )
      .innerJoin(moduleAppVersions, eq(moduleAppVersions.id, moduleAppInstallations.versionId))
      .where(eq(moduleAppWebhooks.id, webhookId))
      .limit(1);
    return row ?? null;
  };

  acceptWebhookDelivery = async (input: {
    deliveryId: string;
    payloadSha256: string;
    receivedAt: Date;
    webhookId: string;
  }) =>
    this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(moduleAppWebhookDeliveries)
        .values({
          deliveryId: input.deliveryId,
          payloadSha256: input.payloadSha256,
          receivedAt: input.receivedAt,
          webhookId: input.webhookId,
        })
        .onConflictDoNothing({
          target: [moduleAppWebhookDeliveries.webhookId, moduleAppWebhookDeliveries.deliveryId],
        })
        .returning({ id: moduleAppWebhookDeliveries.id });
      if (!created) {
        const existing = await tx.query.moduleAppWebhookDeliveries.findFirst({
          where: and(
            eq(moduleAppWebhookDeliveries.webhookId, input.webhookId),
            eq(moduleAppWebhookDeliveries.deliveryId, input.deliveryId),
          ),
        });
        if (existing?.status !== 'failed') return { duplicate: true };
        await tx
          .update(moduleAppWebhookDeliveries)
          .set({ payloadSha256: input.payloadSha256, receivedAt: input.receivedAt, status: 'accepted' })
          .where(eq(moduleAppWebhookDeliveries.id, existing.id));
        return { duplicate: false };
      }
      await tx
        .update(moduleAppWebhooks)
        .set({ lastDeliveryAt: input.receivedAt, updatedAt: input.receivedAt })
        .where(eq(moduleAppWebhooks.id, input.webhookId));
      return { duplicate: false };
    });

  updateWebhookDelivery = async (input: {
    deliveryId: string;
    status: 'failed' | 'processed';
    webhookId: string;
  }) => {
    const [delivery] = await this.db
      .update(moduleAppWebhookDeliveries)
      .set({ status: input.status })
      .where(
        and(
          eq(moduleAppWebhookDeliveries.webhookId, input.webhookId),
          eq(moduleAppWebhookDeliveries.deliveryId, input.deliveryId),
        ),
      )
      .returning();
    if (!delivery) throw new Error('MODULE_APP_WEBHOOK_DELIVERY_NOT_FOUND');
    return delivery;
  };

  createSchedule = async (input: {
    createdBy?: string;
    installationId: string;
    nextRunAt: Date;
    schedule: string;
    scheduleKey: string;
    timezone: string;
    workflowKey: string;
    workflowVersion: number;
  }) => {
    const [schedule] = await this.db.insert(moduleAppSchedules).values(input).returning();
    if (!schedule) throw new Error('MODULE_APP_SCHEDULE_CREATE_FAILED');
    return schedule;
  };

  getWebhook = (input: { installationId: string; webhookId: string }) =>
    this.db.query.moduleAppWebhooks.findFirst({
      where: and(
        eq(moduleAppWebhooks.id, input.webhookId),
        eq(moduleAppWebhooks.installationId, input.installationId),
      ),
    });
}
