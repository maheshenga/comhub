// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearStoredMemoryAnalysisTaskId,
  getStoredMemoryAnalysisTaskId,
  storeMemoryAnalysisTaskId,
  subscribeMemoryAnalysisTaskId,
} from './taskPersistence';

describe('memory analysis task persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('stores and reads the latest task id', () => {
    storeMemoryAnalysisTaskId('task-1');

    expect(getStoredMemoryAnalysisTaskId()).toBe('task-1');
  });

  it('ignores stale task ids', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));
    storeMemoryAnalysisTaskId('task-1');

    vi.setSystemTime(new Date('2026-07-03T00:00:01.000Z'));

    expect(getStoredMemoryAnalysisTaskId()).toBeUndefined();
  });

  it('clears the stored task id', () => {
    storeMemoryAnalysisTaskId('task-1');
    clearStoredMemoryAnalysisTaskId();

    expect(getStoredMemoryAnalysisTaskId()).toBeUndefined();
  });

  it('notifies subscribers when the task id changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMemoryAnalysisTaskId(listener);

    storeMemoryAnalysisTaskId('task-1');
    clearStoredMemoryAnalysisTaskId();
    unsubscribe();
    storeMemoryAnalysisTaskId('task-2');

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
