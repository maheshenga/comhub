import type { PlatformPluginListItem } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  filterAndSortPlatformPlugins,
  formatPlatformPluginCredits,
  getPlatformPluginPlanStatusLabel,
  getPlatformPluginRestrictionCopy,
  isPlatformPluginRunnable,
} from './helpers';

const buildPlugin = (overrides: Partial<PlatformPluginListItem>): PlatformPluginListItem => ({
  billing: { defaultMultiplier: 1, externalApiCostCredits: 0, fixedServiceFeeCredits: 0 },
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
  it('returns upgrade guidance for plan denial', () => {
    expect(getPlatformPluginRestrictionCopy('plan_run_denied')).toContain('升级');
  });

  it('returns binding guidance for Agent denial', () => {
    expect(getPlatformPluginRestrictionCopy('agent_not_enabled')).toContain('Agent');
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

    expect(filterAndSortPlatformPlugins([standard, featured], { query: 'research' })).toEqual([
      featured,
    ]);
    expect(filterAndSortPlatformPlugins([standard, featured], {})).toEqual([featured, standard]);
  });

  it('returns clear plan availability labels', () => {
    expect(getPlatformPluginPlanStatusLabel(buildPlugin({ installed: true }))).toEqual({
      color: 'green',
      label: 'Runnable',
    });
    expect(
      getPlatformPluginPlanStatusLabel(
        buildPlugin({ planState: { installable: false, runnable: false, visible: true } }),
      ),
    ).toEqual({ color: 'orange', label: 'Upgrade required' });
  });
});
