import type { PlatformPluginListItem } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  filterAndSortPlatformPlugins,
  formatPlatformPluginCredits,
  getPlatformPluginBillingSummaryValues,
  getPlatformPluginPlanStatusLabel,
  getPlatformPluginRestrictionCopyKey,
  getPlatformPluginRunStatusMeta,
  getPlatformPluginRuntimeLabelKey,
  isPlatformPluginRunnable,
  mergePlatformPluginRunHistoryItems,
} from './helpers';

const buildPlugin = (overrides: Partial<PlatformPluginListItem>): PlatformPluginListItem => ({
  billing: {
    defaultMultiplier: 1,
    externalApiCostCredits: 0,
    failureFixedFeePolicy: 'do_not_charge',
    fixedServiceFeeCredits: 0,
  },
  category: 'research',
  displayName: 'Research Notes',
  icon: 'FileText',
  id: '00000000-0000-4000-8000-000000000001',
  installed: false,
  operations: { featured: false, sortWeight: 0 },
  planState: { installable: true, runnable: true, visible: true },
  runtimeType: 'content_generation',
  slug: 'research-notes',
  status: 'published',
  tags: ['research'],
  ...overrides,
});

describe('platform plugin marketplace helpers', () => {
  it('returns localization keys for run restrictions', () => {
    expect(getPlatformPluginRestrictionCopyKey('plan_run_denied')).toBe(
      'platformPlugins.restriction.planRunDenied',
    );
    expect(getPlatformPluginRestrictionCopyKey('agent_not_enabled')).toBe(
      'platformPlugins.restriction.agentNotEnabled',
    );
    expect(getPlatformPluginRestrictionCopyKey('unknown_reason')).toBe(
      'platformPlugins.restriction.unknown',
    );
  });

  it('returns status label metadata for run results', () => {
    expect(getPlatformPluginRunStatusMeta('succeeded')).toEqual({
      color: 'green',
      labelKey: 'platformPlugins.runHistory.status.succeeded',
    });
    expect(getPlatformPluginRunStatusMeta('failed')).toEqual({
      color: 'red',
      labelKey: 'platformPlugins.runHistory.status.failed',
    });
  });

  it('requires visible installable runnable installed state before running', () => {
    expect(
      isPlatformPluginRunnable({
        installed: true,
        planState: { installable: true, runnable: true, visible: true },
      }),
    ).toBe(true);
    expect(
      isPlatformPluginRunnable({
        installed: false,
        planState: { installable: true, runnable: true, visible: true },
      }),
    ).toBe(false);
  });

  it('formats credit values for compact marketplace display', () => {
    expect(formatPlatformPluginCredits(1_500_000)).toBe('1.5M');
    expect(formatPlatformPluginCredits(800)).toBe('800');
  });

  it('filters marketplace plugins and orders featured plugins first', () => {
    const standard = buildPlugin({
      displayName: 'Standard Writer',
      id: '00000000-0000-4000-8000-000000000002',
      operations: { featured: false, sortWeight: 100 },
      slug: 'standard-writer',
    });
    const featured = buildPlugin({
      displayName: 'Featured Research',
      id: '00000000-0000-4000-8000-000000000003',
      operations: { featured: true, promoLabel: 'Hot', sortWeight: 1 },
      slug: 'featured-research',
    });

    expect(filterAndSortPlatformPlugins([standard, featured], { query: 'featured' })).toEqual([
      featured,
    ]);
    expect(filterAndSortPlatformPlugins([standard, featured], { query: 'research' })).toEqual([
      featured,
      standard,
    ]);
    expect(filterAndSortPlatformPlugins([standard, featured], {})).toEqual([featured, standard]);
  });

  it('returns clear plan availability labels', () => {
    expect(getPlatformPluginPlanStatusLabel(buildPlugin({ installed: true }))).toEqual({
      color: 'green',
      labelKey: 'platformPlugins.marketplace.status.runnable',
    });
    expect(
      getPlatformPluginPlanStatusLabel(
        buildPlugin({ planState: { installable: false, runnable: false, visible: true } }),
      ),
    ).toEqual({
      color: 'orange',
      labelKey: 'platformPlugins.marketplace.status.upgradeRequired',
    });
  });

  it('prioritizes plan run restrictions before install state', () => {
    expect(
      getPlatformPluginPlanStatusLabel(
        buildPlugin({
          installed: false,
          planState: { installable: true, runnable: false, visible: true },
        }),
      ),
    ).toEqual({
      color: 'orange',
      labelKey: 'platformPlugins.marketplace.status.upgradeRequired',
    });
  });

  it('returns installable label key for uninstalled runnable plugins', () => {
    expect(
      getPlatformPluginPlanStatusLabel(
        buildPlugin({
          installed: false,
          planState: { installable: true, runnable: true, visible: true },
        }),
      ),
    ).toEqual({
      color: 'default',
      labelKey: 'platformPlugins.marketplace.status.installable',
    });
  });

  it('returns semantic runtime label keys for marketplace cards', () => {
    expect(getPlatformPluginRuntimeLabelKey('api_action')).toBe(
      'platformPlugins.marketplace.runtime.apiAction',
    );
    expect(getPlatformPluginRuntimeLabelKey('content_generation')).toBe(
      'platformPlugins.marketplace.runtime.contentGeneration',
    );
  });

  it('returns billing summary values for localized formatting', () => {
    expect(
      getPlatformPluginBillingSummaryValues(
        buildPlugin({
          billing: {
            defaultMultiplier: 3,
            externalApiCostCredits: 0,
            failureFixedFeePolicy: 'do_not_charge',
            fixedServiceFeeCredits: 1_500,
          },
        }),
      ),
    ).toEqual({
      fixedCredits: '1.5K',
      multiplier: 3,
    });
  });

  it('merges run history pages without duplicating run ids', () => {
    const first = {
      artifactIds: [],
      chargedCredits: 10,
      createdAt: '2026-07-09T00:00:00.000Z',
      fixedServiceFeeCharged: false,
      pluginId: 'plugin-1',
      pluginName: 'Research Notes',
      runId: 'run-1',
      status: 'succeeded' as const,
    };
    const duplicate = { ...first, chargedCredits: 20 };
    const second = { ...first, runId: 'run-2', status: 'failed' as const };

    expect(mergePlatformPluginRunHistoryItems([first], [duplicate, second])).toEqual([
      first,
      second,
    ]);
  });
});
