import { and, asc, eq, inArray, lt, lte, or, sql } from 'drizzle-orm';

import { moduleAppWorkflowNodes, moduleAppWorkflowRuns } from '../schemas';
import type { LobeChatDatabase } from '../type';

type ModuleAppWorkflowModelOptions = {
  leaseMs?: number;
  now?: () => Date;
};

export class ModuleAppWorkflowModel {
  private readonly leaseMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly db: LobeChatDatabase,
    options: ModuleAppWorkflowModelOptions = {},
  ) {
    this.leaseMs = options.leaseMs ?? 30_000;
    if (this.leaseMs < 100 || this.leaseMs > 300_000) {
      throw new Error('MODULE_APP_WORKFLOW_LEASE_INVALID');
    }
    this.now = options.now ?? (() => new Date());
  }

  createRun = async (input: {
    context?: Record<string, unknown>;
    createdBy?: string;
    idempotencyKey: string;
    installationId: string;
    nodes: Array<{
      inputSummary?: Record<string, unknown>;
      key: string;
      maxAttempts?: number;
      status?: 'pending' | 'queued';
    }>;
    workflowKey: string;
    workflowVersion: number;
  }) => {
    if (input.nodes.length < 1 || input.nodes.length > 100) {
      throw new Error('MODULE_APP_WORKFLOW_NODES_INVALID');
    }

    return this.db.transaction(async (tx) => {
      const [run] = await tx
        .insert(moduleAppWorkflowRuns)
        .values({
          context: input.context,
          createdBy: input.createdBy,
          idempotencyKey: input.idempotencyKey,
          installationId: input.installationId,
          workflowKey: input.workflowKey,
          workflowVersion: input.workflowVersion,
        })
        .returning();
      if (!run) throw new Error('MODULE_APP_WORKFLOW_RUN_CREATE_FAILED');

      await tx.insert(moduleAppWorkflowNodes).values(
        input.nodes.map((node) => ({
          inputSummary: node.inputSummary,
          installationId: input.installationId,
          maxAttempts: node.maxAttempts ?? 1,
          nodeKey: node.key,
          runId: run.id,
          status: node.status ?? 'queued',
        })),
      );
      return run;
    });
  };

  getRun = async (input: { installationId: string; runId: string }) => {
    const run = await this.db.query.moduleAppWorkflowRuns.findFirst({
      where: and(
        eq(moduleAppWorkflowRuns.id, input.runId),
        eq(moduleAppWorkflowRuns.installationId, input.installationId),
      ),
    });
    return run ?? null;
  };

  claimRunnableNode = async ({ workerId }: { workerId: string }) => {
    const now = this.now();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseMs);

    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ id: moduleAppWorkflowNodes.id, runId: moduleAppWorkflowNodes.runId })
        .from(moduleAppWorkflowNodes)
        .innerJoin(moduleAppWorkflowRuns, eq(moduleAppWorkflowRuns.id, moduleAppWorkflowNodes.runId))
        .where(
          and(
            inArray(moduleAppWorkflowRuns.status, ['queued', 'running']),
            lte(moduleAppWorkflowNodes.availableAt, now),
            lt(moduleAppWorkflowNodes.attempt, moduleAppWorkflowNodes.maxAttempts),
            or(
              eq(moduleAppWorkflowNodes.status, 'queued'),
              and(
                eq(moduleAppWorkflowNodes.status, 'running'),
                lte(moduleAppWorkflowNodes.leaseExpiresAt, now),
              ),
            ),
          ),
        )
        .orderBy(asc(moduleAppWorkflowNodes.availableAt), asc(moduleAppWorkflowNodes.createdAt))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!candidate) return null;

      const [claimed] = await tx
        .update(moduleAppWorkflowNodes)
        .set({
          attempt: sql`${moduleAppWorkflowNodes.attempt} + 1`,
          leaseExpiresAt,
          startedAt: now,
          status: 'running',
          updatedAt: now,
          workerId,
        })
        .where(eq(moduleAppWorkflowNodes.id, candidate.id))
        .returning();
      if (!claimed) return null;

      await tx
        .update(moduleAppWorkflowRuns)
        .set({ startedAt: now, status: 'running', updatedAt: now })
        .where(
          and(
            eq(moduleAppWorkflowRuns.id, candidate.runId),
            eq(moduleAppWorkflowRuns.status, 'queued'),
          ),
        );
      return claimed;
    });
  };
}
