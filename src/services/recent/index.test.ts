import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';

import { recentService } from './index';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    recent: {
      getAll: { query: vi.fn() },
    },
  },
}));

describe('recentService.getAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lambdaClient.recent.getAll.query).mockResolvedValue([]);
  });

  it('preserves the legacy numeric limit call', async () => {
    await recentService.getAll(12);
    expect(lambdaClient.recent.getAll.query).toHaveBeenCalledWith({ limit: 12 });
  });

  it('passes typed recent filters to the router', async () => {
    await recentService.getAll({ limit: 30, types: ['topic'] });
    expect(lambdaClient.recent.getAll.query).toHaveBeenCalledWith({
      limit: 30,
      types: ['topic'],
    });
  });
});
