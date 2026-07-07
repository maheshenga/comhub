import type { PlatformPluginListItem } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { buildPlatformPluginMentionItems, buildPlatformPluginRunRoute } from './platformPluginMentions';

const createPlugin = (overrides: Partial<PlatformPluginListItem> = {}): PlatformPluginListItem =>
  ({
    billing: {
      defaultMultiplier: 1,
      externalApiCostCredits: 0,
      failureFixedFeePolicy: 'do_not_charge',
      fixedServiceFeeCredits: 0,
    },
    category: 'productivity',
    displayName: 'Dictionary Lookup',
    icon: 'BookOpen',
    id: 'plugin-1',
    installed: true,
    planState: { installable: true, runnable: true, visible: true },
    runtimeType: 'api_action',
    slug: 'dictionary-lookup',
    status: 'published',
    tags: [],
    ...overrides,
  }) as PlatformPluginListItem;

describe('platform plugin mentions', () => {
  it('keeps runnable platform plugins separate from MCP and Skills action tags', () => {
    const items = buildPlatformPluginMentionItems([
      createPlugin(),
      createPlugin({ displayName: 'Hidden Plugin', id: 'plugin-2', planState: { installable: true, runnable: false, visible: true } }),
      createPlugin({ displayName: 'Not Installed', id: 'plugin-3', installed: false }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('platform-plugin-plugin-1');
    expect(items[0].label).toBe('Dictionary Lookup');
    expect(items[0].metadata).toEqual(
      expect.objectContaining({
        pluginId: 'plugin-1',
        pluginSlug: 'dictionary-lookup',
        type: 'platformPlugin',
      }),
    );
    expect(items[0].metadata).not.toHaveProperty('actionCategory');
    expect(items[0].metadata).not.toHaveProperty('actionType');
  });

  it('builds an explicit plugin run route with the current agent id', () => {
    expect(
      buildPlatformPluginRunRoute({
        agentId: 'agt_001',
        pluginIdOrSlug: 'dictionary-lookup',
      }),
    ).toBe('/plugins/dictionary-lookup?agentId=agt_001');
  });
});
