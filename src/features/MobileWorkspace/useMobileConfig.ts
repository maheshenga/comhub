'use client';

import useSWR from 'swr';

import {
  DEFAULT_MOBILE_CONFIG,
  type MobilePublicConfigV1,
  normalizeMobileConfig,
} from '@/const/mobileConfig';
import { lambdaClient } from '@/libs/trpc/client';

const MOBILE_CONFIG_SWR_KEY = 'public-mobile-config';

const fetchMobileConfig = async (): Promise<MobilePublicConfigV1> =>
  normalizeMobileConfig(await lambdaClient.admin.settings.getPublicMobileConfig.query());

export const useMobileConfig = () => {
  const { data, error, isLoading, mutate } = useSWR<MobilePublicConfigV1>(
    MOBILE_CONFIG_SWR_KEY,
    fetchMobileConfig,
    {
      dedupingInterval: 60_000,
      fallbackData: normalizeMobileConfig(DEFAULT_MOBILE_CONFIG),
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  return {
    config: normalizeMobileConfig(data),
    error,
    isLoading,
    mutate,
  };
};
