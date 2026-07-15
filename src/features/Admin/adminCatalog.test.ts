import { ADMIN_CAPABILITIES } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  ADMIN_LEGACY_ROUTES,
} from './adminCatalog';

describe('adminCatalog', () => {
  it('defines the approved eight admin groups in order', () => {
    expect(ADMIN_CATALOG_GROUPS.map((group) => group.key)).toEqual([
      'overview',
      'user-access',
      'commercial',
      'ai-platform',
      'module-apps',
      'content-operations',
      'client-integrations',
      'system-security',
    ]);
  });

  it('keeps route IDs, segments, and paths unique', () => {
    expect(new Set(ADMIN_CATALOG.map((item) => item.id)).size).toBe(ADMIN_CATALOG.length);
    expect(new Set(ADMIN_CATALOG.map((item) => item.segment)).size).toBe(ADMIN_CATALOG.length);
    expect(new Set(ADMIN_CATALOG.map((item) => item.path)).size).toBe(ADMIN_CATALOG.length);
  });

  it('keeps compatibility routes outside the visible catalog', () => {
    expect(ADMIN_LEGACY_ROUTES).toEqual([
      { segment: 'pricing', targetSegment: 'model-billing-matrix' },
      { segment: 'topup', targetSegment: 'orders' },
      { segment: 'change-requests', targetSegment: 'subscriptions' },
    ]);
    expect(ADMIN_CATALOG.map((item) => item.segment)).not.toEqual(
      expect.arrayContaining(['pricing', 'topup', 'change-requests']),
    );
  });

  it('assigns read capabilities to high-risk domains', () => {
    const byId = Object.fromEntries(ADMIN_CATALOG.map((item) => [item.id, item]));

    expect(byId.users.readCapability).toBe(ADMIN_CAPABILITIES.userRead);
    expect(byId.providers.readCapability).toBe(ADMIN_CAPABILITIES.modelOpsRead);
    expect(byId.topics.readCapability).toBe(ADMIN_CAPABILITIES.contentRead);
    expect(byId.settings.readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId['module-apps'].readCapability).toBe(ADMIN_CAPABILITIES.moduleAppRead);
  });
});
