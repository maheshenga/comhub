'use client';

import useSWR from 'swr';

import {
  DEFAULT_MOBILE_CONFIG,
  normalizeMobileConfig,
} from '@/const/mobileConfig';
import type { MobileConfigRevisionSnapshot } from '@/const/mobileConfigPublication';
import { mutate as globalMutate } from '@/libs/swr';
import { lambdaClient } from '@/libs/trpc/client';

export const MOBILE_CONFIG_SWR_KEY = 'public-mobile-config';

export const refreshMobileConfig = () => globalMutate(MOBILE_CONFIG_SWR_KEY);

const fallbackSnapshot: MobileConfigRevisionSnapshot = {
  config: normalizeMobileConfig(DEFAULT_MOBILE_CONFIG),
  revision: 0,
  updatedAt: new Date(0).toISOString(),
};

const fetchMobileConfig = async (): Promise<MobileConfigRevisionSnapshot> => {
  const snapshot = await lambdaClient.admin.settings.getPublicMobileConfigSnapshot.query();
  return { ...snapshot, config: normalizeMobileConfig(snapshot.config) };
};

export const useMobileConfig = () => {
  const { data, error, isLoading, isValidating, mutate } = useSWR<MobileConfigRevisionSnapshot>(
    MOBILE_CONFIG_SWR_KEY,
    fetchMobileConfig,
    {
      dedupingInterval: 60_000,
      fallbackData: fallbackSnapshot,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
    },
  );

  return {
    config: normalizeMobileConfig(data?.config),
    error,
    isLoading,
    isValidating,
    mutate,
    revision: data?.revision ?? 0,
    updatedAt: data?.updatedAt ?? fallbackSnapshot.updatedAt,
  };
};
