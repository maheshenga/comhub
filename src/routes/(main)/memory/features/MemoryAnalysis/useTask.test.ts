// @vitest-environment happy-dom

import { AsyncTaskStatus } from '@lobechat/types';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userMemoryKeys } from '@/libs/swr/keys';

import { storeMemoryAnalysisTaskId } from './taskPersistence';

const mockUseClientDataSWR = vi.hoisted(() => vi.fn());
const mockGetTask = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: mockUseClientDataSWR,
}));

vi.mock('@/services/userMemory/extraction', () => ({
  memoryExtractionService: {
    getTask: mockGetTask,
  },
}));

describe('useMemoryAnalysisAsyncTask', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockUseClientDataSWR.mockReturnValue({
      data: null,
      mutate: mockMutate,
    });
  });

  it('queries the stored task id when recovering after navigation', async () => {
    storeMemoryAnalysisTaskId('a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0');

    const { useMemoryAnalysisAsyncTask } = await import('./useTask');
    renderHook(() => useMemoryAnalysisAsyncTask());

    const [, fetcher] = mockUseClientDataSWR.mock.calls.at(-1)!;
    expect(mockUseClientDataSWR.mock.calls.at(-1)![0]).toEqual(
      userMemoryKeys.analysisTask('a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0'),
    );

    await fetcher();

    expect(mockGetTask).toHaveBeenCalledWith('a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0');
  });

  it('stores a newly discovered active task id', async () => {
    mockUseClientDataSWR.mockReturnValue({
      data: {
        id: 'b0b0b0b0-b0b0-4b0b-b0b0-b0b0b0b0b0b0',
        metadata: { progress: { completedTopics: 0, totalTopics: 1 }, source: 'chat_topic' },
        status: AsyncTaskStatus.Processing,
      },
      mutate: mockMutate,
    });

    const { getStoredMemoryAnalysisTaskId } = await import('./taskPersistence');
    const { useMemoryAnalysisAsyncTask } = await import('./useTask');
    renderHook(() => useMemoryAnalysisAsyncTask());

    await waitFor(() => {
      expect(getStoredMemoryAnalysisTaskId()).toBe('b0b0b0b0-b0b0-4b0b-b0b0-b0b0b0b0b0b0');
    });
  });
});
