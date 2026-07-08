// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  platformPluginAgentBindings,
  platformPlugins,
  platformPluginVersions,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { PlatformPluginModel } from '../platformPlugin';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new PlatformPluginModel(serverDB);

const userId = 'platform-plugin-user';
const adminUserId = 'platform-plugin-admin';
const baseBilling = {
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge' as const,
  fixedServiceFeeCredits: 0,
};
const defaultOperations = { featured: false, sortWeight: 0 };

beforeEach(async () => {
  await serverDB.delete(platformPlugins);
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }, { id: adminUserId }]);
});

describe('PlatformPluginModel marketplace behavior', () => {
  it('lists only published plugins visible to a plan', async () => {
    await model.upsertPluginForAdmin({
      billing: baseBilling,
      category: 'productivity',
      description: 'Lookup a public dictionary.',
      displayName: 'Dictionary Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'published',
      tags: ['lookup'],
    });
    await model.setPlanEntitlements('dictionary-lookup', [
      {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'free',
        runnable: true,
        visible: true,
      },
    ]);

    await model.upsertPluginForAdmin({
      billing: baseBilling,
      category: 'productivity',
      description: 'This should stay hidden.',
      displayName: 'Hidden Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'hidden-lookup',
      status: 'published',
      tags: ['lookup'],
    });
    await model.setPlanEntitlements('hidden-lookup', [
      {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'free',
        runnable: true,
        visible: false,
      },
    ]);

    await model.upsertPluginForAdmin({
      billing: baseBilling,
      category: 'productivity',
      description: 'Still in draft.',
      displayName: 'Draft Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'draft-lookup',
      status: 'draft',
      tags: ['lookup'],
    });
    await model.setPlanEntitlements('draft-lookup', [
      {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'free',
        runnable: true,
        visible: true,
      },
    ]);

    const rows = await model.listMarketplacePlugins({ plan: 'free', userId });

    expect(rows.map((item) => item.slug)).toEqual(['dictionary-lookup']);
    expect(rows[0]).toMatchObject({
      installed: false,
      planState: { installable: true, runnable: true, visible: true },
      status: 'published',
    });
  });

  it('returns published plugin detail with action and entitlement snapshots', async () => {
    const plugin = await model.upsertPluginForAdmin({
      actionConfig: {
        api: {
          method: 'POST',
          timeoutMs: 30_000,
          url: 'https://api.example.com/dictionary',
        },
        id: 'lookup_word',
        inputSchema: { fields: [{ key: 'term', label: 'Term', required: true, type: 'text' }] },
        moduleMultiplier: 1,
        name: 'Lookup Word',
        runtimeType: 'api_action',
      },
      billing: baseBilling,
      category: 'productivity',
      description: 'Lookup a public dictionary.',
      displayName: 'Dictionary Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'published',
      tags: ['lookup'],
    });
    await model.setPlanEntitlements('dictionary-lookup', [
      {
        discountPercent: 10,
        freeQuotaCredits: 25,
        installable: true,
        plan: 'free',
        runnable: true,
        visible: true,
      },
    ]);

    const detail = await model.getPluginDetail({
      plan: 'free',
      pluginIdOrSlug: plugin.slug,
      userId,
    });

    expect(detail).not.toBeNull();
    expect(detail).toMatchObject({
      description: 'Lookup a public dictionary.',
      entitlements: [{ freeQuotaCredits: 25, plan: 'free', visible: true }],
      id: plugin.id,
      slug: 'dictionary-lookup',
    });
    expect(detail?.actions).toHaveLength(1);
    expect(detail?.actions[0]).toMatchObject({
      id: 'lookup_word',
      name: 'Lookup Word',
      runtimeType: 'api_action',
    });
    expect(detail?.version).toBeTruthy();
  });

  it('removes stale actions when a plugin is upserted without actionConfig', async () => {
    const plugin = await model.upsertPluginForAdmin({
      actionConfig: {
        api: {
          method: 'POST',
          timeoutMs: 30_000,
          url: 'https://api.example.com/dictionary',
        },
        id: 'lookup_word',
        inputSchema: { fields: [{ key: 'term', label: 'Term', required: true, type: 'text' }] },
        moduleMultiplier: 1,
        name: 'Lookup Word',
        runtimeType: 'api_action',
      },
      billing: baseBilling,
      category: 'productivity',
      description: 'Lookup a public dictionary.',
      displayName: 'Dictionary Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'published',
      tags: ['lookup'],
    });
    await model.setPlanEntitlements('dictionary-lookup', [
      {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'free',
        runnable: true,
        visible: true,
      },
    ]);

    const originalDetail = await model.getPluginDetail({
      plan: 'free',
      pluginIdOrSlug: plugin.slug,
      userId,
    });

    expect(originalDetail?.actions).toHaveLength(1);

    await model.upsertPluginForAdmin({
      billing: baseBilling,
      category: 'productivity',
      description: 'Lookup a public dictionary.',
      displayName: 'Dictionary Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'published',
      tags: ['lookup'],
    });

    const updatedDetail = await model.getPluginDetail({
      plan: 'free',
      pluginIdOrSlug: plugin.slug,
      userId,
    });

    expect(updatedDetail?.actions).toEqual([]);

    const [version] = await serverDB
      .select({ id: platformPluginVersions.id, version: platformPluginVersions.version })
      .from(platformPluginVersions)
      .where(eq(platformPluginVersions.pluginId, plugin.id));

    expect(version?.id).toBeTruthy();
    expect(version?.version).toBeTruthy();

    await model.installPlugin({
      pluginId: plugin.id,
      userId,
      versionId: version!.id,
    });

    await expect(model.listInstalledPlugins({ userId })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          installationSource: 'platform_plugin_installations',
          slug: 'dictionary-lookup',
        }),
      ]),
    );
  });

  it('installs from the new platform plugin installation table and supports uninstall', async () => {
    const plugin = await model.upsertPluginForAdmin({
      billing: baseBilling,
      category: 'productivity',
      description: 'Lookup a public dictionary.',
      displayName: 'Dictionary Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'published',
      tags: ['lookup'],
    });
    await model.setPlanEntitlements('dictionary-lookup', [
      {
        discountPercent: 0,
        freeQuotaCredits: 0,
        installable: true,
        plan: 'free',
        runnable: true,
        visible: true,
      },
    ]);

    const [version] = await serverDB
      .select({ id: platformPluginVersions.id, version: platformPluginVersions.version })
      .from(platformPluginVersions)
      .where(eq(platformPluginVersions.pluginId, plugin.id));

    expect(version?.id).toBeTruthy();
    expect(version?.version).toBeTruthy();

    await model.installPlugin({
      pluginId: plugin.id,
      userId,
      versionId: version!.id,
    });

    const installed = await model.listInstalledPlugins({ userId });

    expect(installed).toHaveLength(1);
    expect(installed[0]).toMatchObject({
      installationSource: 'platform_plugin_installations',
      installed: true,
      slug: 'dictionary-lookup',
    });

    await model.uninstallPlugin({ pluginId: plugin.id, userId });

    await expect(model.listInstalledPlugins({ userId })).resolves.toEqual([]);
  });

  it('upserts agent bindings for a plugin and user', async () => {
    const plugin = await model.upsertPluginForAdmin({
      billing: baseBilling,
      category: 'productivity',
      description: 'Lookup a public dictionary.',
      displayName: 'Dictionary Lookup',
      icon: 'BookOpen',
      operations: defaultOperations,
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'published',
      tags: ['lookup'],
    });

    await model.setAgentBinding({
      agentId: 'agent-alpha',
      enabled: true,
      pluginId: plugin.id,
      userId,
    });
    await model.setAgentBinding({
      agentId: 'agent-alpha',
      enabled: false,
      pluginId: plugin.id,
      userId,
    });

    const binding = await serverDB.query.platformPluginAgentBindings.findFirst({
      where: eq(platformPluginAgentBindings.pluginId, plugin.id),
    });

    expect(binding).toMatchObject({
      agentId: 'agent-alpha',
      enabled: false,
      pluginId: plugin.id,
      userId,
    });
  });
});
