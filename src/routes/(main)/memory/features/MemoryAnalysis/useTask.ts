import { AsyncTaskStatus } from '@lobechat/types';
import { useEffect, useSyncExternalStore } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { userMemoryKeys } from '@/libs/swr/keys';
import { type MemoryExtractionTask } from '@/services/userMemory/extraction';
import { memoryExtractionService } from '@/services/userMemory/extraction';

import {
  getStoredMemoryAnalysisTaskId,
  storeMemoryAnalysisTaskId,
  subscribeMemoryAnalysisTaskId,
} from './taskPersistence';

export const useMemoryAnalysisAsyncTask = (taskId?: string) => {
  const storedTaskId = useSyncExternalStore(
    subscribeMemoryAnalysisTaskId,
    getStoredMemoryAnalysisTaskId,
    () => undefined,
  );
  const effectiveTaskId = taskId ?? storedTaskId;

  const swr = useClientDataSWR<MemoryExtractionTask | null>(
    effectiveTaskId ? userMemoryKeys.analysisTask(effectiveTaskId) : userMemoryKeys.analysisTask(),
    () => memoryExtractionService.getTask(effectiveTaskId),
    {
      refreshInterval: (data) =>
        data && [AsyncTaskStatus.Pending, AsyncTaskStatus.Processing].includes(data.status)
          ? 30_000
          : 0,
    },
  );

  useEffect(() => {
    if (!taskId) return;

    storeMemoryAnalysisTaskId(taskId);
  }, [taskId]);

  useEffect(() => {
    if (!swr.data?.id || taskId) return;

    storeMemoryAnalysisTaskId(swr.data.id);
  }, [swr.data?.id, taskId]);

  useEffect(() => {
    if (!swr.data) return;

    const isRunning = [AsyncTaskStatus.Pending, AsyncTaskStatus.Processing].includes(
      swr.data.status,
    );
    if (!isRunning) return;

    const timer = setInterval(() => {
      swr.mutate();
    }, 5000);

    return () => clearInterval(timer);
  }, [swr.data?.id, swr.data?.status, swr.mutate]);

  return {
    ...swr,
    refresh: swr.mutate,
  };
};
