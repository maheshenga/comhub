// @vitest-environment node
import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../packages/database/src/core/getTestDB';
import {
  platformPluginActions,
  platformPluginPlanEntitlements,
  platformPlugins,
} from '../packages/database/src/schemas';
import type { LobeChatDatabase } from '../packages/database/src/type';
import { seedPlatformPlugins } from './seedPlatformPlugins';

const serverDB: LobeChatDatabase = await getTestDB();
const sampleSlugs = ['dictionary-lookup', 'research-notes'];

beforeEach(async () => {
  await serverDB.delete(platformPlugins).where(inArray(platformPlugins.slug, sampleSlugs));
});

afterEach(async () => {
  await serverDB.delete(platformPlugins).where(inArray(platformPlugins.slug, sampleSlugs));
});

describe('seedPlatformPlugins', () => {
  it('is idempotent by platform plugin slug and creates the two P1 sample plugins', async () => {
    await seedPlatformPlugins({ db: serverDB });
    await seedPlatformPlugins({ db: serverDB });

    const rows = await serverDB.query.platformPlugins.findMany({
      where: inArray(platformPlugins.slug, sampleSlugs),
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.slug).sort()).toEqual(sampleSlugs);
    expect(rows.map((row) => row.runtimeType).sort()).toEqual(['api_action', 'content_generation']);
    expect(rows.every((row) => row.status === 'draft')).toBe(true);

    const dictionary = rows.find((row) => row.slug === 'dictionary-lookup')!;
    const research = rows.find((row) => row.slug === 'research-notes')!;
    const actions = await serverDB.query.platformPluginActions.findMany({
      where: inArray(platformPluginActions.pluginId, [dictionary.id, research.id]),
    });
    const freeEntitlement = await serverDB.query.platformPluginPlanEntitlements.findFirst({
      where: eq(platformPluginPlanEntitlements.pluginId, dictionary.id),
    });

    expect(actions.map((action) => action.actionKey).sort()).toEqual([
      'dictionary_lookup',
      'generate_research_notes',
    ]);
    expect(freeEntitlement).toMatchObject({
      installable: true,
      plan: 'free',
      runnable: true,
      visible: true,
    });
  });
});
