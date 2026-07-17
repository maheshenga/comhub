import { ADMIN_CAPABILITIES } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  ADMIN_LEGACY_ROUTES,
  getAdminCatalogAccessCapabilities,
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
      { segment: 'topics', targetSegment: 'content-resources' },
      { segment: 'files', targetSegment: 'content-resources' },
      { segment: 'documents', targetSegment: 'content-resources' },
      { segment: 'recommendations', targetSegment: 'content-operations' },
      { segment: 'expert-plaza', targetSegment: 'content-operations' },
      { segment: 'notifications', targetSegment: 'content-operations' },
      { segment: 'operations', targetSegment: 'content-operations' },
      { segment: 'system-defaults', targetSegment: 'ai-runtime-defaults' },
    ]);
    expect(ADMIN_CATALOG.map((item) => item.segment)).not.toEqual(
      expect.arrayContaining([
        'pricing',
        'topup',
        'change-requests',
        'topics',
        'files',
        'documents',
        'recommendations',
        'expert-plaza',
        'notifications',
        'operations',
        'system-defaults',
      ]),
    );
  });

  it('assigns default-setting pages to the responsible admin domains', () => {
    const byId = Object.fromEntries(ADMIN_CATALOG.map((item) => [item.id, item]));

    expect(byId['ai-runtime-defaults']).toMatchObject({
      group: 'ai-platform',
      segment: 'ai-runtime-defaults',
    });
    expect(byId['user-defaults']).toMatchObject({
      group: 'user-access',
      segment: 'user-defaults',
    });
    expect(byId.integrations).toMatchObject({
      group: 'client-integrations',
      segment: 'integrations',
    });
  });

  it('assigns read capabilities to high-risk domains', () => {
    const byId = Object.fromEntries(ADMIN_CATALOG.map((item) => [item.id, item]));

    expect(byId.users.readCapability).toBe(ADMIN_CAPABILITIES.userRead);
    expect(byId.providers.readCapability).toBe(ADMIN_CAPABILITIES.modelOpsRead);
    expect(byId['content-resources'].readCapability).toBe(ADMIN_CAPABILITIES.contentRead);
    expect(byId['content-operations'].readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId.settings.readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId['model-policy'].readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId['model-policy'].writeCapabilities).toEqual([ADMIN_CAPABILITIES.systemWrite]);
    expect(getAdminCatalogAccessCapabilities(byId['model-billing-matrix'])).toEqual([
      ADMIN_CAPABILITIES.modelOpsRead,
      ADMIN_CAPABILITIES.financeRead,
      ADMIN_CAPABILITIES.systemRead,
    ]);
    const moduleApps = ADMIN_CATALOG.find((item) => item.id === 'module-apps');
    expect(moduleApps?.readCapability).toBe(ADMIN_CAPABILITIES.moduleAppRead);
    expect(moduleApps?.accessCapabilities).toEqual([
      ADMIN_CAPABILITIES.moduleAppRead,
      ADMIN_CAPABILITIES.financeRead,
    ]);
  });
});
