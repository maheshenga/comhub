import { Plans } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSubscriptionPlan } from '@/business/server/user';
import { getServerDB } from '@/database/core/db-adaptor';

import { platformPluginRouter } from './platformPlugin';

const platformPluginModelMocks = vi.hoisted(() => ({
  getPluginDetail: vi.fn(),
  installPlugin: vi.fn(),
  listInstalledPlugins: vi.fn(),
  listMarketplacePlugins: vi.fn(),
  setAgentBinding: vi.fn(),
  uninstallPlugin: vi.fn(),
}));

vi.mock('@/business/server/user', () => ({
  getSubscriptionPlan: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/platformPlugin', () => ({
  PlatformPluginModel: vi.fn(() => platformPluginModelMocks),
}));

const pluginId = '00000000-0000-4000-8000-000000000001';

const baseMarketplaceItem = {
  billing: {},
  category: 'productivity',
  displayName: 'Dictionary Lookup',
  icon: 'BookOpen',
  id: pluginId,
  installed: true,
  planState: {
    installable: true,
    runnable: true,
    visible: true,
  },
  runtimeType: 'api_action',
  slug: 'dictionary-lookup',
  status: 'published',
  tags: [],
} as const;

const baseDetail = {
  ...baseMarketplaceItem,
  actions: [
    {
      id: 'dictionary_lookup',
      inputSchema: { fields: [] },
      moduleMultiplier: 1,
      name: 'Dictionary Lookup',
      runtimeType: 'api_action',
    },
  ],
  description: 'Lookup a public dictionary.',
  entitlements: [
    {
      discountPercent: 0,
      freeQuotaCredits: 0,
      installable: true,
      plan: Plans.Free,
      runnable: true,
      visible: true,
    },
  ],
  version: '1.0.0',
} as const;

const createAuthedCaller = ({ plan = Plans.Free, userId = 'user-a' } = {}) => {
  vi.mocked(getSubscriptionPlan).mockResolvedValue(plan);

  return platformPluginRouter.createCaller({ userId } as any);
};

describe('lambda.platformPlugin router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerDB).mockResolvedValue({
      query: {
        platformPluginAgentBindings: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        platformPluginInstallations: {
          findFirst: vi.fn().mockResolvedValue({ id: 'installation-1' }),
        },
        platformPluginVersions: {
          findFirst: vi.fn().mockResolvedValue({ id: 'version-1', version: '1.0.0' }),
        },
      },
    } as any);
    platformPluginModelMocks.getPluginDetail.mockResolvedValue(baseDetail);
    platformPluginModelMocks.installPlugin.mockResolvedValue(undefined);
    platformPluginModelMocks.listInstalledPlugins.mockResolvedValue([baseMarketplaceItem]);
    platformPluginModelMocks.listMarketplacePlugins.mockResolvedValue([baseMarketplaceItem]);
    platformPluginModelMocks.setAgentBinding.mockResolvedValue(undefined);
    platformPluginModelMocks.uninstallPlugin.mockResolvedValue(undefined);
  });

  it('lists only plugins visible to the current user plan', async () => {
    const caller = createAuthedCaller({ plan: Plans.Free, userId: 'user-a' });

    const rows = await caller.listMarketplace();

    expect(rows.every((item) => item.planState.visible)).toBe(true);
    expect(platformPluginModelMocks.listMarketplacePlugins).toHaveBeenCalledWith({
      plan: Plans.Free,
      userId: 'user-a',
    });
  });

  it('denies running plugins that are not enabled for the selected Agent', async () => {
    const caller = createAuthedCaller({ plan: Plans.Free, userId: 'user-a' });

    await expect(
      caller.run({
        actionId: 'dictionary_lookup',
        agentId: 'agt_001',
        input: { word: 'apple' },
        pluginId,
      }),
    ).rejects.toMatchObject({ message: 'agent_not_enabled' });
  });
});
