/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTask: vi.fn(),
  // SWR 层被 mock 掉，测试只关心本 hook 自己驱动的轮询：调用次数、并发度、
  // 隐藏态下是否安静。
  mutate: vi.fn(),
}));

vi.mock('@lobechat/types', () => ({
  AsyncTaskStatus: { Error: 'error', Pending: 'pending', Processing: 'processing', Success: 'success' },
}));

vi.mock('@/libs/swr', () => ({
  useClientPollingSWR: (_key: unknown, _fetch: unknown, _config?: unknown) => ({
    data: mocks.task,
    error: undefined,
    isLoading: false,
    mutate: mocks.mutate,
  }),
}));

vi.mock('@/libs/swr/keys', () => ({
  userMemoryKeys: { analysisTask: (id?: string) => ['userMemory:analysisTask', id] },
}));

vi.mock('@/services/userMemory/extraction', () => ({
  memoryExtractionService: { getTask: mocks.getTask },
}));

const importHook = async () => (await import('./useTask')).useMemoryAnalysisAsyncTask;

/** 等待若干个轮询周期，让定时器有机会触发。 */
const advance = async (ms: number) => {
  vi.advanceTimersByTime(ms);
  await Promise.resolve();
  await Promise.resolve();
};

// happy-dom 的 document.visibilityState 是只读 getter，只能重定义。
const setVisibility = (state: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
};

describe('useMemoryAnalysisAsyncTask polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.mutate.mockReset();
    mocks.mutate.mockResolvedValue(undefined);
    (mocks as unknown as { task?: unknown }).task = {
      id: 'task-1',
      status: 'processing',
    };
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls while the task is running and stops once it reaches a terminal state', async () => {
    const useTask = await importHook();
    const { rerender } = renderHook(() => useTask('task-1'));

    await advance(5000);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);

    await advance(5000);
    expect(mocks.mutate).toHaveBeenCalledTimes(2);

    // 真实 SWR 拿到新数据后会重渲染；mock 是静态的，所以手动 rerender 一次
    // 才能让 hook 看到终态并停表。
    (mocks as unknown as { task: unknown }).task = { id: 'task-1', status: 'success' };
    rerender();

    await advance(10_000);
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });

  // 此前 SWR 的 30s refreshInterval 与手写 5s setInterval 并存；现在只有一个
  // 轮询用 setTimeout 链式调度（不是 setInterval），所以相邻两拍天然不会重叠；
  // 真正需要 in-flight 闸的是「请求还在飞的时候可见性又变了」这条路径——
  // 回到前台会立刻补一次，若不排队就会和在途请求叠上。
  it('queues a visibility-triggered refresh instead of stacking it on an in-flight poll', async () => {
    let release: (() => void) | undefined;
    mocks.mutate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const useTask = await importHook();
    renderHook(() => useTask('task-1'));

    await advance(5000);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);

    // 第一个请求仍在飞，此时切到后台再切回前台。
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await advance(0);

    // 不应因为可见性抖动而再叠一个请求。
    expect(mocks.mutate).toHaveBeenCalledTimes(1);

    release?.();
    await advance(0);

    // 在途请求完成后，排队的补刷才发出，且只补一次。
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
    release?.();
  });

  it('issues no requests while the tab is hidden', async () => {
    setVisibility('hidden');

    const useTask = await importHook();
    renderHook(() => useTask('task-1'));

    await advance(60_000);

    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('refreshes immediately when the tab becomes visible again', async () => {
    setVisibility('hidden');

    const useTask = await importHook();
    renderHook(() => useTask('task-1'));

    await advance(30_000);
    expect(mocks.mutate).not.toHaveBeenCalled();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    await advance(0);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('does not poll before any task data has arrived', async () => {
    (mocks as unknown as { task: unknown }).task = undefined;

    const useTask = await importHook();
    renderHook(() => useTask('task-1'));

    await advance(60_000);

    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
