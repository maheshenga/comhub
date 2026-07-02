'use client';

import { type ReactNode } from 'react';
import { createContext, memo, use, useCallback, useEffect, useMemo, useState } from 'react';

export type FaviconState = 'default' | 'done' | 'error' | 'progress';

interface FaviconStateContextValue {
  currentState: FaviconState;
  isDevMode: boolean;
}

interface FaviconSettersContextValue {
  setFavicon: (state: FaviconState) => void;
  setIsDevMode: (isDev: boolean) => void;
}

const FaviconStateContext = createContext<FaviconStateContextValue | null>(null);
const FaviconSettersContext = createContext<FaviconSettersContextValue | null>(null);

export const useFaviconState = () => {
  const context = use(FaviconStateContext);
  if (!context) {
    throw new Error('useFaviconState must be used within FaviconProvider');
  }
  return context;
};

export const useFaviconSetters = () => {
  const context = use(FaviconSettersContext);
  if (!context) {
    throw new Error('useFaviconSetters must be used within FaviconProvider');
  }
  return context;
};

const stateToFileName: Record<FaviconState, string> = {
  default: '',
  done: '-done',
  error: '-error',
  progress: '-progress',
};

const getFaviconPath = (state: FaviconState, isDev: boolean, size?: '32x32'): string => {
  const devSuffix = isDev ? '-dev' : '';
  const stateSuffix = stateToFileName[state];
  const sizeSuffix = size ? `-${size}` : '';
  return `/favicon${sizeSuffix}${stateSuffix}${devSuffix}.ico`;
};

const getFaviconHref = (
  state: FaviconState,
  isDev: boolean,
  size: '32x32' | undefined,
  defaultFaviconUrl?: null | string,
) => {
  const customDefaultFavicon = defaultFaviconUrl?.trim();

  if (state === 'default' && customDefaultFavicon) return customDefaultFavicon;

  return `${getFaviconPath(state, isDev, size)}?v=${Date.now()}`;
};

const updateFaviconDOM = (
  state: FaviconState,
  isDev: boolean,
  defaultFaviconUrl?: null | string,
) => {
  if (typeof document === 'undefined') return;

  const head = document.head;
  const existingLinks = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]',
  );

  if (existingLinks.length === 0) {
    const iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    iconLink.href = getFaviconHref(state, isDev, undefined, defaultFaviconUrl);
    head.append(iconLink);

    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.href = getFaviconHref(state, isDev, '32x32', defaultFaviconUrl);
    head.append(shortcutLink);
    return;
  }

  existingLinks.forEach((link) => {
    const is32 = link.href.includes('32x32');
    const rel = link.rel;

    link.remove();

    const newLink = document.createElement('link');
    newLink.rel = rel;
    newLink.href = getFaviconHref(
      state,
      isDev,
      is32 ? '32x32' : undefined,
      defaultFaviconUrl,
    );
    head.append(newLink);
  });
};

export const FaviconProvider = memo<{
  children: ReactNode;
  defaultFaviconUrl?: null | string;
}>(({ children, defaultFaviconUrl }) => {
  const [currentState, setCurrentState] = useState<FaviconState>('default');
  const [isDevMode, setIsDevModeState] = useState<boolean>(__DEV__);

  const setFavicon = useCallback(
    (state: FaviconState) => {
      setCurrentState(state);
      setIsDevModeState((isDev) => {
        updateFaviconDOM(state, isDev, defaultFaviconUrl);
        return isDev;
      });
    },
    [defaultFaviconUrl],
  );

  const setIsDevMode = useCallback(
    (isDev: boolean) => {
      setIsDevModeState(isDev);
      setCurrentState((state) => {
        updateFaviconDOM(state, isDev, defaultFaviconUrl);
        return state;
      });
    },
    [defaultFaviconUrl],
  );

  useEffect(() => {
    if (currentState !== 'default') return;
    updateFaviconDOM(currentState, isDevMode, defaultFaviconUrl);
  }, [currentState, defaultFaviconUrl, isDevMode]);

  const stateValue = useMemo(() => ({ currentState, isDevMode }), [currentState, isDevMode]);

  const settersValue = useMemo(() => ({ setFavicon, setIsDevMode }), [setFavicon, setIsDevMode]);

  return (
    <FaviconStateContext value={stateValue}>
      <FaviconSettersContext value={settersValue}>{children}</FaviconSettersContext>
    </FaviconStateContext>
  );
});

FaviconProvider.displayName = 'FaviconProvider';
