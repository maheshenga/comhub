import {
  MemoryExtractionExecutor,
  type MemoryExtractionNormalizedPayload,
} from '@/server/services/memory/userMemory/extract';
import { APP_SETTING_KEYS, getAppSettingValue } from '@/server/services/appSettings';
import { type AsyncTaskModel } from '@/database/models/asyncTask';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@/types/asyncTask';

const DIRECT_MEMORY_EXTRACTION_TOPIC_PAGE_SIZE = 25;

export type UserMemoryTriggerMode = 'auto' | 'direct' | 'workflow';

const normalizeUserMemoryTriggerMode = (value: unknown): UserMemoryTriggerMode | null =>
  value === 'auto' || value === 'direct' || value === 'workflow' ? value : null;

/**
 * Resolve how memory extraction runs: env override, then the admin app
 * setting, defaulting to auto.
 */
export const resolveUserMemoryTriggerMode = async (db: unknown): Promise<UserMemoryTriggerMode> => {
  const envMode = normalizeUserMemoryTriggerMode(process.env.MEMORY_USER_MEMORY_TRIGGER_MODE);
  if (envMode) return envMode;

  const adminMode = normalizeUserMemoryTriggerMode(
    await getAppSettingValue(APP_SETTING_KEYS.memoryUserMemoryTriggerMode, db as any),
  );

  return adminMode ?? 'auto';
};

export const shouldRunMemoryExtractionDirectly = async (db: unknown) => {
  const mode = await resolveUserMemoryTriggerMode(db);

  if (mode === 'direct') return true;

  // Auto mode and workflow-preferred mode both fall back to direct execution
  // when QStash is not configured, which matches single-node Node deployments.
  return !process.env.QSTASH_TOKEN;
};

/**
 * Run memory extraction in-process, batched by topic, without QStash. Marked
 * void at the call site — failures land on the async task, not the response.
 */
export const scheduleDirectMemoryExtraction = (
  payload: MemoryExtractionNormalizedPayload,
  options: {
    asyncTaskModel: AsyncTaskModel;
    taskId: string;
    userId: string;
  },
) => {
  void (async () => {
    try {
      await options.asyncTaskModel.update(options.taskId, { status: AsyncTaskStatus.Processing });

      const executor = await MemoryExtractionExecutor.create();
      let processedTopics = 0;

      for (const userId of payload.userIds.length ? payload.userIds : [options.userId]) {
        let cursor: Awaited<ReturnType<MemoryExtractionExecutor['getTopicsForUser']>>['cursor'];

        do {
          const topicBatch = await executor.getTopicsForUser(
            {
              cursor,
              forceAll: payload.forceAll,
              forceTopics: payload.forceTopics,
              from: payload.from,
              to: payload.to,
              userId,
            },
            DIRECT_MEMORY_EXTRACTION_TOPIC_PAGE_SIZE,
          );

          cursor = topicBatch.cursor;
          if (!topicBatch.ids.length) continue;

          processedTopics += topicBatch.ids.length;
          await executor.runDirect({
            ...payload,
            mode: 'direct',
            topicCursor: undefined,
            topicIds: topicBatch.ids,
            userId,
            userIds: [userId],
          });
        } while (cursor);
      }

      if (processedTopics === 0) {
        await options.asyncTaskModel.update(options.taskId, { status: AsyncTaskStatus.Success });
      }
    } catch (error) {
      console.error('[user-memory] direct memory extraction failed', error);
      await options.asyncTaskModel.update(options.taskId, {
        error: new AsyncTaskError(
          AsyncTaskErrorType.TaskTriggerError,
          error instanceof Error ? error.message : 'Failed to run memory extraction directly',
        ),
        status: AsyncTaskStatus.Error,
      });
    }
  })();
};
