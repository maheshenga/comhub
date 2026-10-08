import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAdminCursorQuery, useAdminCursorState } from './useAdminCursorQuery';

vi.mock('@/libs/swr', () => {
  let implementation:
    ((key: readonly unknown[] | null, fetcher: () => unknown) => unknown) | undefined;

  const useClientDataSWR = (key: readonly unknown[] | null, fetcher: () => unknown) => {
    if (implementation) return implementation(key, fetcher);
    if (!key) return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
    // Synchronous resolved-data semantics (same pattern as
    // AdminPagination.test.tsx): test fetchers below are plain functions.
    return { data: fetcher(), error: undefined, isLoading: false, mutate: vi.fn() };
  };

  return {
    setUseClientDataSWRImplementation: (next: typeof implementation) => {
      implementation = next;
    },
    useClientDataSWR,
  };
});

type SwrMockImplementation = (key: readonly unknown[] | null, fetcher: () => unknown) => unknown;

const setSwrImplementation = async (next: SwrMockImplementation) => {
  const mod = (await import('@/libs/swr')) as unknown as {
    setUseClientDataSWRImplementation: (next: SwrMockImplementation) => void;
  };
  mod.setUseClientDataSWRImplementation(next);
};

describe('useAdminCursorState', () => {
  it('advances, retreats and resets an opaque cursor trail without arithmetic', () => {
    const { result } = renderHook(() => useAdminCursorState<number>());

    expect(result.current.cursor).toBeUndefined();
    expect(result.current.canRetreat).toBe(false);

    act(() => result.current.advance(20));
    expect(result.current.cursor).toBe(20);
    expect(result.current.canRetreat).toBe(true);

    act(() => result.current.advance(35));
    expect(result.current.cursor).toBe(35);

    act(() => result.current.retreat());
    expect(result.current.cursor).toBe(20);

    act(() => result.current.retreat());
    expect(result.current.cursor).toBeUndefined();
    expect(result.current.canRetreat).toBe(false);

    // retreat on the first page is a no-op
    act(() => result.current.retreat());
    expect(result.current.cursor).toBeUndefined();

    act(() => {
      result.current.advance(7);
      result.current.reset();
    });
    expect(result.current.cursor).toBeUndefined();
    expect(result.current.canRetreat).toBe(false);
  });
});

describe('useAdminCursorQuery', () => {
  it('fetches the first page, advances through the returned cursor and gates hasNext', async () => {
    const fetcher = vi.fn(({ cursor, limit }: { cursor?: number; limit: number }) => ({
      items: [`page-for-${cursor ?? 'first'}`],
      nextCursor: cursor === undefined ? 20 : null,
      limitEcho: limit,
    }));

    const { result } = renderHook(() =>
      useAdminCursorQuery<string, { items: string[]; nextCursor: null | number }>({
        key: 'admin-shared-test',
        fetcher: fetcher as never,
      }),
    );

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(fetcher).toHaveBeenCalledWith({ cursor: undefined, limit: 50 });
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrevious).toBe(false);

    act(() => result.current.pager.onNext());

    await waitFor(() => expect(result.current.data?.items[0]).toBe('page-for-20'));
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrevious).toBe(true);

    act(() => result.current.pager.onPrevious());
    await waitFor(() => expect(result.current.data?.items[0]).toBe('page-for-first'));
  });

  it('resets the trail when filter deps change', async () => {
    const fetcher = vi.fn(({ cursor }: { cursor?: string }) => ({
      items: [cursor ?? 'first'],
      nextCursor: null,
    }));

    const { result, rerender } = renderHook(
      ({ status }: { status?: string }) =>
        useAdminCursorQuery<string, { items: string[] }>({
          key: 'admin-shared-test-deps',
          deps: [status],
          fetcher: fetcher as never,
        }),
      { initialProps: { status: undefined } as { status?: string } },
    );

    await waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => result.current.state.advance('cursor-2'));
    expect(result.current.state.cursor).toBe('cursor-2');

    rerender({ status: 'published' });

    // The trail resets to the first page on a filter change.
    await waitFor(() => expect(result.current.state.cursor).toBeUndefined());
    expect(result.current.hasNext).toBe(false);
  });

  it('surfaces the SWR error instead of dropping it', async () => {
    await setSwrImplementation(() => ({
      data: undefined,
      error: new Error('network down'),
      isLoading: false,
      mutate: vi.fn(),
    }));

    const { result } = renderHook(() =>
      useAdminCursorQuery<string, unknown>({
        key: 'admin-shared-test-error',
        fetcher: async () => ({ items: [] }),
      }),
    );

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('network down');
  });
});
