'use client';

import { useCallback, useEffect, useState } from 'react';

type Cursor = number | string;

export const useCursorPagination = (resetKey: string) => {
  const [cursors, setCursors] = useState<Cursor[]>([0]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setCursors([0]);
    setPage(0);
  }, [resetKey]);

  const next = useCallback(
    (cursor: Cursor | null | undefined) => {
      if (cursor === null || cursor === undefined) return;
      setCursors((current) => {
        const updated = current.slice(0, page + 1);
        updated[page + 1] = cursor;
        return updated;
      });
      setPage((current) => current + 1);
    },
    [page],
  );

  const previous = useCallback(() => setPage((current) => Math.max(0, current - 1)), []);

  return {
    cursor: cursors[page] ?? 0,
    hasPrevious: page > 0,
    next,
    page,
    previous,
  };
};
