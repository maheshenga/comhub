import { type SpendOrigin } from '@lobechat/types';
import debug from 'debug';
import { and, eq } from 'drizzle-orm';

import { assertModelPolicyAllowed } from '@/business/server/modelPolicy';
import { assertPlanModelAllowed } from '@/business/server/planModelRules';
import { type AiUsageRouteMetadata } from '@/database/models/commercial';
import {
  asyncTasks,
  generationBatches,
  generations,
  type NewGeneration,
  type NewGenerationBatch,
} from '@/database/schemas';
import { type LobeChatDatabase, type Transaction } from '@/database/type';
import { resolveNewapiRouteMetadataForModel } from '@/server/services/newapiInstance';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';
import { generateUniqueSeeds } from '@/utils/number';

const log = debug('lobe-generation-billing-guard');

/**
 * Shared generation-router gates for ComHub billing: model policy + plan
 * checks, newapi route metadata resolution, and charge-metadata assembly.
 * Kept fork-owned so upstream refactors of the image/video routers re-apply
 * without touching these call sites.
 */
export const assertGenerationModelAllowed = async ({
  db,
  modelType,
  provider,
  resolvedModelId,
  userId,
}: {
  db: LobeChatDatabase;
  modelType: 'image' | 'video';
  provider: string;
  resolvedModelId: string;
  userId: string;
}) => {
  await assertModelPolicyAllowed({
    db,
    model: resolvedModelId,
    provider,
    usageType: modelType,
  });
  await assertPlanModelAllowed({
    db,
    model: resolvedModelId,
    modelType,
    userId,
  });
};

export const resolveGenerationRouteMetadata = async ({
  db,
  modelType,
  provider,
  resolvedModelId,
  userId,
}: {
  db: LobeChatDatabase;
  modelType: 'image' | 'video';
  provider: string;
  resolvedModelId: string;
  userId: string;
}): Promise<AiUsageRouteMetadata | undefined> =>
  provider === 'newapi'
    ? resolveNewapiRouteMetadataForModel(db, {
        modelId: resolvedModelId,
        modelType,
        userId,
      })
    : undefined;

/** Attach route metadata to a charge metadata object when present. */
export const withRouteMetadata = <T extends Record<string, unknown>>(
  metadata: T,
  routeMetadata: AiUsageRouteMetadata | undefined,
): T & { routeMetadata?: AiUsageRouteMetadata } =>
  routeMetadata === undefined ? metadata : { ...metadata, routeMetadata };

interface ReleaseReservationParams {
  /** e.g. `video-reservation` / `image-reservation:${index}` — trace id only. */
  asyncTaskId: string;
  db: LobeChatDatabase;
  generationBatchId: string;
  modelId: string;
  prechargeResult: Record<string, unknown>;
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  userId: string;
  workspaceId?: string;
}

/**
 * Release one billing reservation after the record-creation transaction
 * failed — the reservation would otherwise dangle until it expires.
 * `chargeAfterGenerate` is the generation-type-specific implementation, passed
 * in so this module stays decoupled from the video/image billing modules.
 */
export const releaseGenerationReservation = async <Charge extends (params: never) => unknown>(
  chargeAfterGenerate: Charge,
  {
    db,
    asyncTaskId,
    generationBatchId,
    modelId,
    prechargeResult,
    provider,
    routeMetadata,
    userId,
    workspaceId,
  }: ReleaseReservationParams,
) => {
  return chargeAfterGenerate({
    db,
    isError: true,
    metadata: withRouteMetadata(
      {
        asyncTaskId,
        generationBatchId,
        modelId,
        topicId: generationBatchId,
      },
      routeMetadata,
    ),
    model: modelId,
    prechargeResult,
    provider,
    userId,
    workspaceId,
  } as Parameters<Charge>[0]);
};

/**
 * Reconcile every generation's billing handle when the async router never
 * started for the batch — its own failure billing cannot fire.
 */
export const reconcileGenerationReservations = async <Charge extends (params: never) => unknown>(
  chargeAfterGenerate: Charge,
  {
    db,
    asyncTaskIds,
    generationBatchId,
    modelId,
    prechargeItems,
    provider,
    routeMetadata,
    spendOrigin,
    userId,
    workspaceId,
  }: {
    db: LobeChatDatabase;
    asyncTaskIds: string[];
    generationBatchId: string;
    modelId: string;
    prechargeItems: unknown[];
    provider: string;
    routeMetadata?: AiUsageRouteMetadata;
    spendOrigin?: SpendOrigin;
    userId: string;
    workspaceId?: string;
  },
) => {
  const results = await Promise.allSettled(
    asyncTaskIds.map(async (asyncTaskId, index) => {
      const prechargeItem = prechargeItems[index];
      if (prechargeItem === undefined) return;

      await chargeAfterGenerate({
        db,
        isError: true,
        metadata: withRouteMetadata(
          {
            ...spendOrigin,
            asyncTaskId,
            generationBatchId,
            modelId,
            topicId: generationBatchId,
          },
          routeMetadata,
        ),
        prechargeResult: prechargeItem,
        provider,
        userId,
        workspaceId,
      } as Parameters<Charge>[0]);
    }),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to reconcile billing for task ${asyncTaskIds[index]}:`, result.reason);
    }
  });
};

export interface VideoGenerationRecordInput {
  configForDatabase: Record<string, unknown>;
  generationTopicId: string;
  model: string;
  prechargeResult: Record<string, unknown> | undefined;
  /** Continuation source (upstream v2.2.19); persisted on the async task metadata. */
  previousGenerationId?: string;
  prompt: string;
  provider: string;
  routeMetadata: AiUsageRouteMetadata | undefined;
  spendOrigin: SpendOrigin | undefined;
  userId: string;
  webhookToken: string;
  workspaceId?: string;
}

/**
 * Create the video generation batch, generation, and async task atomically.
 * The async task metadata carries the precharge handle, route metadata, and
 * spend origin so the completion charge (which runs in a webhook/polling
 * context that no longer sees this request) can reconcile and attribute.
 */
export const createVideoGenerationRecords = async (
  db: LobeChatDatabase,
  {
    configForDatabase,
    generationTopicId,
    model,
    previousGenerationId,
    prechargeResult,
    prompt,
    provider,
    routeMetadata,
    spendOrigin,
    userId,
    webhookToken,
    workspaceId,
  }: VideoGenerationRecordInput,
) =>
  db.transaction(async (tx: Transaction) => {
    log('Starting database transaction for video generation');

    // 1. Create generationBatch
    const newBatch: NewGenerationBatch = {
      config: configForDatabase,
      generationTopicId,
      model,
      prompt,
      provider,
      userId,
      workspaceId,
    };
    log('Creating generation batch: %O', newBatch);
    const [batch] = await tx.insert(generationBatches).values(newBatch).returning();
    log('Generation batch created: %s', batch.id);

    // 2. Create single generation (video is always 1)
    const newGeneration: NewGeneration = {
      generationBatchId: batch.id,
      seed: null,
      userId,
      workspaceId,
    };
    const [generation] = await tx.insert(generations).values(newGeneration).returning();
    log('Generation created: %s', generation.id);

    // 3. Create asyncTask with precharge metadata
    const [asyncTask] = await tx
      .insert(asyncTasks)
      .values({
        metadata: {
          ...(prechargeResult ? { precharge: prechargeResult } : {}),
          ...(previousGenerationId ? { previousGenerationId } : {}),
          ...withRouteMetadata(
            {
              ...(spendOrigin ? { spendOrigin } : {}),
              webhookToken,
            },
            routeMetadata,
          ),
        },
        status: AsyncTaskStatus.Pending,
        type: AsyncTaskType.VideoGeneration,
        userId,
        workspaceId,
      })
      .returning();
    log('Async task created: %s', asyncTask.id);

    // 4. Link asyncTask to generation
    await tx
      .update(generations)
      .set({ asyncTaskId: asyncTask.id })
      .where(and(eq(generations.id, generation.id), eq(generations.userId, userId)));

    return {
      asyncTaskCreatedAt: asyncTask.createdAt,
      asyncTaskId: asyncTask.id,
      batch,
      generation,
    };
  });

export interface ImageGenerationRecordInput {
  configForDatabase: Record<string, unknown>;
  generationTopicId: string;
  height: number | undefined;
  imageNum: number;
  model: string;
  prechargeItems: unknown[] | undefined;
  prompt: string;
  provider: string;
  spendOrigin: SpendOrigin | undefined;
  userId: string;
  width: number | undefined;
  workspaceId?: string;
}

/**
 * Create the image generation batch, its generations, and one async task per
 * generation atomically. Each async task carries its generation's billing
 * handle (if any) plus the spend origin, so the completion charge in the
 * async router can reconcile and attribute without seeing this request.
 */
export const createImageGenerationRecords = async (
  db: LobeChatDatabase,
  {
    configForDatabase,
    generationTopicId,
    height,
    imageNum,
    model,
    prechargeItems,
    prompt,
    provider,
    spendOrigin,
    userId,
    width,
    workspaceId,
  }: ImageGenerationRecordInput,
) =>
  db.transaction(async (tx: Transaction) => {
    log('Starting database transaction for image generation');

    // 1. Create generationBatch
    const newBatch: NewGenerationBatch = {
      config: configForDatabase,
      generationTopicId,
      height,
      model,
      prompt,
      provider,
      userId,
      workspaceId,
      width,
    };
    log('Creating generation batch: %O', newBatch);
    const [batch] = await tx.insert(generationBatches).values(newBatch).returning();
    log('Generation batch created successfully: %s', batch.id);

    // 2. Create generations
    const seeds =
      'seed' in configForDatabase
        ? generateUniqueSeeds(imageNum)
        : Array.from({ length: imageNum }, () => null);
    const newGenerations: NewGeneration[] = Array.from({ length: imageNum }, (_, index) => {
      return {
        generationBatchId: batch.id,
        seed: seeds[index],
        userId,
        workspaceId,
      };
    });

    log('Creating %d generations for batch: %s', newGenerations.length, batch.id);
    const createdGenerations = await tx.insert(generations).values(newGenerations).returning();
    log(
      'Generations created successfully: %O',
      createdGenerations.map((g) => g.id),
    );

    // 3. Concurrently create asyncTask for each generation (within transaction)
    log('Creating async tasks for generations');
    const generationsWithTasks = await Promise.all(
      createdGenerations.map(async (generation, index) => {
        // Create asyncTask directly in transaction, carrying this
        // generation's billing handle (if any) for the completion charge.
        // Presence check (not truthiness): handles are opaque, so falsy
        // values like 0 or '' must still be stored verbatim.
        const prechargeItem = prechargeItems?.[index];
        // The completion charge runs in the async router, which no longer
        // sees this request; carry the origin attribution on the task so
        // it can still be stamped on the spend log. Stored independently
        // of `precharge` because paths without a billing handle (free /
        // unpriced models) still charge at completion.
        const taskMetadata = {
          ...(prechargeItem === undefined ? {} : { precharge: prechargeItem }),
          ...(spendOrigin ? { spendOrigin } : {}),
        };
        const [createdAsyncTask] = await tx
          .insert(asyncTasks)
          .values({
            metadata: Object.keys(taskMetadata).length === 0 ? undefined : taskMetadata,
            status: AsyncTaskStatus.Pending,
            type: AsyncTaskType.ImageGeneration,
            userId,
            workspaceId,
          })
          .returning();

        const asyncTaskId = createdAsyncTask.id;
        log('Created async task %s for generation %s', asyncTaskId, generation.id);

        // Update generation's asyncTaskId
        await tx
          .update(generations)
          .set({ asyncTaskId })
          .where(and(eq(generations.id, generation.id), eq(generations.userId, userId)));

        return { asyncTaskId, generation };
      }),
    );
    log('All async tasks created in transaction');

    return {
      batch,
      generationsWithTasks,
    };
  });
