import { chargeAfterGenerate } from '@/business/server/video-generation/chargeAfterGenerate';
import type { AiUsageRouteMetadata } from '@/database/models/commercial';
import type { LobeChatDatabase } from '@/database/type';
import debug from 'debug';
import type { SpendOrigin } from '@lobechat/types';

const log = debug('lobe-video:billing-settle');

interface SettleVideoPollingChargeParams {
  asyncTaskId: string;
  batchConfig: unknown;
  db: LobeChatDatabase;
  durationMs: number;
  generationBatchId: string;
  generationTopicId: string;
  modelId: string;
  prechargeResult: Record<string, unknown>;
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  spendOrigin?: SpendOrigin;
  usage?: { completionTokens: number; totalTokens: number };
  userId: string;
  workspaceId?: string;
}

/**
 * Settle the precharge reservation after background video polling succeeded.
 * Errors are logged, not rethrown — the asset is already stored by this point.
 */
export const settleVideoPollingCharge = async ({
  asyncTaskId,
  batchConfig,
  db,
  durationMs,
  generationBatchId,
  generationTopicId,
  modelId,
  prechargeResult,
  provider,
  routeMetadata,
  spendOrigin,
  usage,
  userId,
  workspaceId,
}: SettleVideoPollingChargeParams) => {
  const config = batchConfig as { generateAudio?: boolean; resolution?: string } | null;

  try {
    await chargeAfterGenerate({
      computePriceParams: {
        generateAudio: config?.generateAudio,
        resolution: config?.resolution,
      },
      db,
      latency: durationMs,
      metadata: {
        ...spendOrigin,
        asyncTaskId,
        generationBatchId,
        modelId,
        ...(routeMetadata ? { routeMetadata } : {}),
        topicId: generationTopicId,
      },
      model: modelId,
      prechargeResult,
      provider,
      usage,
      userId,
      workspaceId,
    });
  } catch (chargeError) {
    log('Failed to settle generation billing: %O', chargeError);
  }
};

/**
 * Release the precharge reservation when background polling failed.
 */
export const releaseVideoPollingCharge = async ({
  asyncTaskId,
  db,
  generationBatchId,
  generationTopicId,
  modelId,
  prechargeResult,
  provider,
  routeMetadata,
  userId,
  workspaceId,
}: {
  asyncTaskId: string;
  db: LobeChatDatabase;
  generationBatchId: string;
  generationTopicId: string;
  modelId: string;
  prechargeResult: Record<string, unknown>;
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  userId: string;
  workspaceId?: string;
}) => {
  try {
    await chargeAfterGenerate({
      db,
      isError: true,
      metadata: {
        asyncTaskId,
        generationBatchId,
        modelId,
        ...(routeMetadata ? { routeMetadata } : {}),
        topicId: generationTopicId,
      },
      model: modelId,
      prechargeResult,
      provider,
      userId,
      workspaceId,
    });
  } catch (chargeError) {
    log('Failed to release generation billing: %O', chargeError);
  }
};
