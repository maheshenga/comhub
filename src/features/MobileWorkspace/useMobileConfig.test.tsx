import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOBILE_CONFIG } from '@/const/mobileConfig';
import { lambdaClient } from '@/libs/trpc/client';

import { useMobileConfig } from './useMobileConfig';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    admin: {
      settings: {
        getPublicMobileConfig: { query: vi.fn() },
      },
    },
  },
}));

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

describe('useMobileConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a stable default immediately and normalizes the public response', async () => {
    vi.mocked(lambdaClient.admin.settings.getPublicMobileConfig.query).mockResolvedValue({
      ...DEFAULT_MOBILE_CONFIG,
      brand: { displayName: 'Mobile Brand', logoUrl: null },
    });

    const { result } = renderHook(() => useMobileConfig(), { wrapper });

    expect(result.current.config).toEqual(DEFAULT_MOBILE_CONFIG);
    await waitFor(() => expect(result.current.config.brand.displayName).toBe('Mobile Brand'));
    expect(result.current.error).toBeUndefined();
    expect(result.current.mutate).toEqual(expect.any(Function));
  });

  it('keeps the safe default and exposes an error when the public request fails', async () => {
    vi.mocked(lambdaClient.admin.settings.getPublicMobileConfig.query).mockRejectedValue(
      new Error('offline'),
    );

    const { result } = renderHook(() => useMobileConfig(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.config).toEqual(DEFAULT_MOBILE_CONFIG);
  });
});
