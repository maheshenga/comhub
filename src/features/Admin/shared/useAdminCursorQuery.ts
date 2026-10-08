'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';

/**
 * Cursor pagination state (blueprint §4.2-2). This is the page-level twin of
 * `moduleApps/shared/queryState.ts`: instead of URLSearchParams it tracks the
 * opaque cursor trail in React state, so any Admin list page can adopt the
 * "no cursor arithmetic" advance/retreat pattern that AdminOrdersPage
 * previously hand-rolled with a local `cursorStack`.
 */
export interface AdminCursorState<Cursor> {
  /** Push the next cursor returned by the current page. */
  advance: (nextCursor: Cursor) => void;
  /** True when the trail is deeper than the first page. */
  canRetreat: boolean;
  /** The cursor of the page currently rendered; `undefined` = first page. */
  cursor: Cursor | undefined;
  /** Clear the trail and return to the first page (call on every filter change). */
  reset: () => void;
  /** Pop back one page; on the first page this is a no-op. */
  retreat: () => void;
}

export const useAdminCursorState = <Cursor>(): AdminCursorState<Cursor> => {
  const [trail, setTrail] = useState<Cursor[]>([]);

  const advance = useCallback((nextCursor: Cursor) => {
    setTrail((current) => [...current, nextCursor]);
  }, []);

  const retreat = useCallback(() => {
    setTrail((current) => (current.length > 0 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback(() => {
    setTrail([]);
  }, []);

  return {
    advance,
    canRetreat: trail.length > 0,
    cursor: trail.at(-1),
    reset,
    retreat,
  };
};

export interface UseAdminCursorQueryOptions<Cursor, Data> {
  /** Extra SWR key parts; changing any of them resets the cursor trail. */
  deps?: readonly unknown[];
  /** Fetch one page. Receives `{ cursor, limit }`; resolves items + next cursor. */
  fetcher: (page: { cursor: Cursor | undefined; limit: number }) => Promise<Data>;
  /** SWR key prefix, e.g. `'admin-orders'`. */
  key: string;
  /** Limit param handed to the fetcher; defaults to 50 like the legacy pages. */
  limit?: number;
}

export interface AdminCursorQueryResult<Cursor, Data> {
  data: Data | undefined;
  error: unknown;
  hasNext: boolean;
  hasPrevious: boolean;
  isLoading: boolean;
  mutate: () => Promise<unknown>;
  nextCursor: Cursor | null | undefined;
  /** Derived pager state for `AdminDataTable.pager`. */
  pager: { hasNext: boolean; hasPrevious: boolean; onNext: () => void; onPrevious: () => void };
  state: AdminCursorState<Cursor>;
}

/**
 * Cursor-paginated SWR query (blueprint §4.2-2). Wraps useClientDataSWR with
 * the cursor trail: filter `deps` changes reset to the first page, `nextCursor`
 * from the current response gates the next button and the previous button pops
 * the trail. `error` is surfaced first-class — pages must feed it to
 * AdminPageState/AdminDataTable rather than dropping it.
 */
export const useAdminCursorQuery = <Cursor, Data>(
  options: UseAdminCursorQueryOptions<Cursor, Data>,
): AdminCursorQueryResult<Cursor, Data> => {
  const { deps = [], fetcher, key, limit = 50 } = options;
  const state = useAdminCursorState<Cursor>();
  const { cursor, advance, canRetreat, reset, retreat } = state;

  // A filter change (any `deps` entry) returns the list to its first page:
  // the stale cursor trail belongs to the previous filter combination.
  const depsKey = useMemo(() => JSON.stringify(deps), [deps]);
  const depsKeyRef = useRef(depsKey);
  useEffect(() => {
    if (depsKeyRef.current !== depsKey) {
      depsKeyRef.current = depsKey;
      reset();
    }
  }, [depsKey, reset]);

  const swrKey = useMemo(() => [key, cursor, limit, ...deps] as const, [key, cursor, limit, deps]);

  const { data, error, isLoading, mutate } = useClientDataSWR(swrKey, () =>
    fetcher({ cursor, limit }),
  );

  const dataRecord = data as { nextCursor?: Cursor | null } | undefined;
  const nextCursor = dataRecord?.nextCursor;
  const hasNext = nextCursor != null;

  const onNext = useCallback(() => {
    if (nextCursor != null) advance(nextCursor);
  }, [advance, nextCursor]);

  const pager = useMemo(
    () => ({ hasNext, hasPrevious: canRetreat, onNext, onPrevious: retreat }),
    [canRetreat, hasNext, onNext, retreat],
  );

  return {
    data,
    error,
    hasNext,
    hasPrevious: canRetreat,
    isLoading: Boolean(isLoading),
    mutate: mutate as () => Promise<unknown>,
    nextCursor,
    pager,
    state: { ...state, reset },
  };
};

export default useAdminCursorQuery;
