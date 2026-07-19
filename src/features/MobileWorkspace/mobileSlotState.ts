'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

type MobileSlotId = 'slot-1' | 'slot-2' | 'slot-3' | 'slot-4';

export interface MobileSlotState {
  focusKey?: string;
  query: string;
  scrollTop: number;
}

const EMPTY_SLOT_STATE: MobileSlotState = { query: '', scrollTop: 0 };
const STORAGE_PREFIX = 'comhub:mobile-slot-state:v1';

const getStorageKey = (scopeId: string, slotId: MobileSlotId) =>
  `${STORAGE_PREFIX}:${encodeURIComponent(scopeId)}:${slotId}`;

export const readMobileSlotState = (scopeId: string, slotId: MobileSlotId): MobileSlotState => {
  if (typeof window === 'undefined') return EMPTY_SLOT_STATE;

  try {
    const value = window.sessionStorage.getItem(getStorageKey(scopeId, slotId));
    if (!value) return EMPTY_SLOT_STATE;
    const parsed = JSON.parse(value);
    return {
      focusKey: typeof parsed.focusKey === 'string' ? parsed.focusKey : undefined,
      query: typeof parsed.query === 'string' ? parsed.query : '',
      scrollTop:
        typeof parsed.scrollTop === 'number' && Number.isFinite(parsed.scrollTop)
          ? Math.max(0, parsed.scrollTop)
          : 0,
    };
  } catch {
    return EMPTY_SLOT_STATE;
  }
};

export const writeMobileSlotState = (
  scopeId: string,
  slotId: MobileSlotId,
  state: Partial<MobileSlotState>,
) => {
  if (typeof window === 'undefined') return;

  const nextState = { ...readMobileSlotState(scopeId, slotId), ...state };
  try {
    window.sessionStorage.setItem(getStorageKey(scopeId, slotId), JSON.stringify(nextState));
  } catch {
    // Restoration is best-effort when storage is unavailable or full.
  }
};

const findFocusTarget = (container: HTMLElement, focusKey: string) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-mobile-focus-key]')).find(
    (element) => element.dataset.mobileFocusKey === focusKey,
  );

export const useMobileSlotState = ({
  scopeId,
  scrollRef,
  slotId,
}: {
  scopeId: string;
  scrollRef?: RefObject<HTMLElement | null>;
  slotId: MobileSlotId;
}) => {
  const storageKey = getStorageKey(scopeId, slotId);
  const initialState = readMobileSlotState(scopeId, slotId);
  const [query, setQueryState] = useState(initialState.query);
  const queryRef = useRef(query);
  const focusKeyRef = useRef(initialState.focusKey);
  const scrollTopRef = useRef(initialState.scrollTop);

  useEffect(() => {
    const restored = readMobileSlotState(scopeId, slotId);
    queryRef.current = restored.query;
    focusKeyRef.current = restored.focusKey;
    scrollTopRef.current = restored.scrollTop;
    setQueryState(restored.query);

    const frame = window.requestAnimationFrame(() => {
      const container =
        scrollRef?.current ?? document.getElementById('lobe-mobile-scroll-container');
      if (!container) return;
      container.scrollTop = restored.scrollTop;
      if (restored.focusKey) {
        findFocusTarget(container, restored.focusKey)?.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [scopeId, scrollRef, slotId, storageKey]);

  useEffect(() => {
    const container = scrollRef?.current ?? document.getElementById('lobe-mobile-scroll-container');
    if (!container) return;

    const handleScroll = () => {
      scrollTopRef.current = container.scrollTop;
      writeMobileSlotState(scopeId, slotId, { scrollTop: container.scrollTop });
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      writeMobileSlotState(scopeId, slotId, {
        focusKey: focusKeyRef.current,
        query: queryRef.current,
        scrollTop: container.scrollTop,
      });
    };
  }, [scopeId, scrollRef, slotId, storageKey]);

  const setQuery = useCallback(
    (value: string) => {
      queryRef.current = value;
      setQueryState(value);
      writeMobileSlotState(scopeId, slotId, { query: value });
    },
    [scopeId, slotId],
  );
  const rememberFocus = useCallback(
    (focusKey: string) => {
      focusKeyRef.current = focusKey;
      writeMobileSlotState(scopeId, slotId, { focusKey });
    },
    [scopeId, slotId],
  );

  return { query, rememberFocus, setQuery };
};
