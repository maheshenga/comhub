import { describe, expect, it } from 'vitest';

import { getInitialModuleAppPageKey, resolveModuleAppPagePath } from './runtimeHelpers';

describe('module app runtime helpers', () => {
  const pages = [
    { key: 'overview', routePath: '/', title: 'Overview', type: 'overview' as const },
    { key: 'records', routePath: '/records', title: 'Records', type: 'list' as const },
  ];

  it('uses overview as the first runtime page', () => {
    expect(getInitialModuleAppPageKey(pages)).toBe('overview');
  });

  it('builds stable app page paths', () => {
    expect(resolveModuleAppPagePath('app-1', 'records')).toBe('/apps/app-1/app/records');
  });
});
