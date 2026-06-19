import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { globalHelpers } from '@/store/global/helpers';

import { discoverService } from './discover';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    market: {
      skill: {
        getSkillList: {
          query: vi.fn(),
        },
      },
    },
  },
}));

vi.mock('@/store/global/helpers', () => ({
  globalHelpers: {
    getCurrentLanguage: vi.fn(),
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: {
    getState: vi.fn(() => ({})),
  },
}));

vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: {
    telemetry: vi.fn(() => false),
  },
}));

describe('DiscoverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('en-US');
    vi.mocked(lambdaClient.market.skill.getSkillList.query).mockResolvedValue({
      currentPage: 1,
      items: [],
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    });
  });

  it('injects a market token before fetching skill lists', async () => {
    const injectSpy = vi.spyOn(discoverService, 'safeInjectMPToken').mockResolvedValue(undefined);

    await discoverService.getSkillList({ page: 2, pageSize: 10 });

    expect(injectSpy).toHaveBeenCalledBefore(lambdaClient.market.skill.getSkillList.query as any);
    expect(lambdaClient.market.skill.getSkillList.query).toHaveBeenCalledWith({
      locale: 'en-US',
      page: 2,
      pageSize: 10,
    });
  });
});
