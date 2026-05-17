'use client';

import { useCallback } from 'react';

export const useHeteroAgentCloudConfig = () => {
  const goToConfig = useCallback(() => {}, []);

  return {
    goToConfig,
    isConfigured: true,
  };
};
