import { Plans, type PlatformPluginAdminUpsertInput, type PlatformPluginPlanEntitlement } from '@lobechat/types';
import * as dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import { PlatformPluginModel } from '../packages/database/src/models/platformPlugin';
import type { LobeChatDatabase } from '../packages/database/src/type';

const sampleBilling = {
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge' as const,
  fixedServiceFeeCredits: 0,
};

const entitlement = (
  plan: Plans,
  access: Pick<PlatformPluginPlanEntitlement, 'installable' | 'runnable' | 'visible'>,
): PlatformPluginPlanEntitlement => ({
  discountPercent: 0,
  freeQuotaCredits: 0,
  plan,
  ...access,
});

const allPlans = [Plans.Free, Plans.Hobby, Plans.Starter, Plans.Premium, Plans.Ultimate];
const paidRunnablePlans = [Plans.Starter, Plans.Premium, Plans.Ultimate];

const platformPluginSamples: Array<{
  entitlements: PlatformPluginPlanEntitlement[];
  plugin: PlatformPluginAdminUpsertInput;
}> = [
  {
    entitlements: allPlans.map((plan) =>
      entitlement(plan, { installable: true, runnable: true, visible: true }),
    ),
    plugin: {
      actionConfig: {
        api: {
          method: 'GET',
          responsePath: '0.meanings.0.definitions.0.definition',
          timeoutMs: 30_000,
          url: 'https://api.dictionaryapi.dev/api/v2/entries/en/{word}',
        },
        id: 'dictionary_lookup',
        inputSchema: {
          fields: [{ key: 'word', label: 'Word', required: true, type: 'text' }],
        },
        moduleMultiplier: 1,
        name: 'Dictionary Lookup',
        runtimeType: 'api_action',
      },
      billing: sampleBilling,
      category: 'productivity',
      description: 'Lookup public dictionary definitions from a controlled API action plugin.',
      displayName: 'Dictionary Lookup',
      icon: 'BookOpen',
      runtimeType: 'api_action',
      slug: 'dictionary-lookup',
      status: 'draft',
      tags: ['lookup', 'dictionary'],
    },
  },
  {
    entitlements: allPlans.map((plan) =>
      entitlement(plan, {
        installable: paidRunnablePlans.includes(plan),
        runnable: paidRunnablePlans.includes(plan),
        visible: true,
      }),
    ),
    plugin: {
      actionConfig: {
        contentGeneration: {
          artifactMimeType: 'text/markdown',
          artifactNameTemplate: 'research-notes-{topic}.md',
          promptTemplate:
            'Create concise research notes about {topic} for {audience}. Target length: {length}. Use headings, bullets, and cite open questions.',
        },
        id: 'generate_research_notes',
        inputSchema: {
          fields: [
            { key: 'topic', label: 'Topic', required: true, type: 'text' },
            { key: 'audience', label: 'Audience', required: false, type: 'text' },
            { key: 'length', label: 'Length', required: false, type: 'text' },
          ],
        },
        moduleMultiplier: 1,
        name: 'Generate Research Notes',
        runtimeType: 'content_generation',
      },
      billing: {
        ...sampleBilling,
        defaultMultiplier: 1.35,
        fixedServiceFeeCredits: 10,
      },
      category: 'productivity',
      description: 'Generate structured markdown research notes and store the result as an artifact.',
      displayName: 'Research Notes',
      icon: 'FileText',
      runtimeType: 'content_generation',
      slug: 'research-notes',
      status: 'draft',
      tags: ['research', 'writing'],
    },
  },
];

export const seedPlatformPlugins = async ({ db }: { db: LobeChatDatabase }) => {
  const model = new PlatformPluginModel(db);
  const seeded: Array<{ id: string; slug: string }> = [];

  for (const sample of platformPluginSamples) {
    const plugin = await model.upsertPluginForAdmin(sample.plugin);
    await model.setPlanEntitlements(plugin.slug, sample.entitlements);
    seeded.push(plugin);
  }

  return seeded;
};

const loadEnv = () => {
  const env = process.env.NODE_ENV || 'development';
  dotenvExpand.expand(dotenv.config());
  dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}` }));
  dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}.local` }));
};

const isDirectRun = () => {
  const entry = process.argv[1]?.replaceAll('\\', '/');

  return entry?.endsWith('/seedPlatformPlugins.ts') || entry?.endsWith('/seedPlatformPlugins.js');
};

const main = async () => {
  loadEnv();

  const { serverDB } = await import('../packages/database/src/server');
  const seeded = await seedPlatformPlugins({ db: serverDB });

  for (const plugin of seeded) {
    console.log(`Seeded platform plugin: ${plugin.slug}`);
  }
};

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
