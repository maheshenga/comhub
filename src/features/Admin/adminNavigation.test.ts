import { describe, expect, it } from 'vitest';

import {
  ADMIN_BASE_PATH,
  ADMIN_NAV_GROUPS,
  getAdminOpenKeys,
  getAdminSelectedKey,
} from './adminNavigation';

const collectPaths = () =>
  ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path));

describe('adminNavigation', () => {
  it('organizes admin pages into the planned management modules', () => {
    expect(ADMIN_NAV_GROUPS.map((group) => group.key)).toEqual([
      'overview',
      'user-plan',
      'model-billing',
      'plugins',
      'brand-growth',
      'content',
      'client',
      'system',
    ]);
  });

  it('keeps all visible admin routes reachable without duplicate sidebar paths', () => {
    const paths = collectPaths();

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining([
        ADMIN_BASE_PATH,
        `${ADMIN_BASE_PATH}/users`,
        `${ADMIN_BASE_PATH}/plans`,
        `${ADMIN_BASE_PATH}/orders`,
        `${ADMIN_BASE_PATH}/credits`,
        `${ADMIN_BASE_PATH}/recommendations`,
        `${ADMIN_BASE_PATH}/operations`,
        `${ADMIN_BASE_PATH}/growth`,
        `${ADMIN_BASE_PATH}/notifications`,
        `${ADMIN_BASE_PATH}/expert-plaza`,
        `${ADMIN_BASE_PATH}/model-policy`,
        `${ADMIN_BASE_PATH}/providers`,
        `${ADMIN_BASE_PATH}/model-billing-matrix`,
        `${ADMIN_BASE_PATH}/ppt`,
        `${ADMIN_BASE_PATH}/module-apps`,
        `${ADMIN_BASE_PATH}/subscriptions`,
        `${ADMIN_BASE_PATH}/redemption`,
        `${ADMIN_BASE_PATH}/settings`,
        `${ADMIN_BASE_PATH}/stats`,
        `${ADMIN_BASE_PATH}/topics`,
        `${ADMIN_BASE_PATH}/files`,
        `${ADMIN_BASE_PATH}/file-storage`,
        `${ADMIN_BASE_PATH}/documents`,
        `${ADMIN_BASE_PATH}/system-defaults`,
        `${ADMIN_BASE_PATH}/maintenance`,
        `${ADMIN_BASE_PATH}/audit`,
        `${ADMIN_BASE_PATH}/desktop-update`,
      ]),
    );
  });

  it('labels model pricing and policy tasks as part of the model center', () => {
    const modelApiItems =
      ADMIN_NAV_GROUPS.find((group) => group.key === 'model-billing')?.items ?? [];

    expect(
      modelApiItems.find((item) => item.path === `${ADMIN_BASE_PATH}/model-billing-matrix`),
    ).toMatchObject({
      icon: 'pricing',
    });
    expect(
      modelApiItems.find((item) => item.path === `${ADMIN_BASE_PATH}/model-policy`),
    ).toMatchObject({
      icon: 'models',
    });
  });

  it('describes the model center using current admin concepts', () => {
    const modelApiGroup = ADMIN_NAV_GROUPS.find((group) => group.key === 'model-billing');
    const providerItem = modelApiGroup?.items.find(
      (item) => item.path === `${ADMIN_BASE_PATH}/providers`,
    );

    expect(providerItem?.icon).toBe('providers');
    expect(ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.icon))).not.toContain(
      'newapi',
    );
    expect(providerItem?.description).not.toContain('NewAPI / OpenAI');
    expect(collectPaths()).not.toContain(`${ADMIN_BASE_PATH}/newapi-providers`);
  });

  it('keeps module apps in the extensibility admin module after platform plugin removal', () => {
    const pluginGroup = ADMIN_NAV_GROUPS.find((group) => group.key === 'plugins');

    expect(pluginGroup).toMatchObject({
      icon: 'plugins',
    });
    expect(pluginGroup?.items).toContainEqual(
      expect.objectContaining({
        icon: 'plugins',
        path: `${ADMIN_BASE_PATH}/module-apps`,
      }),
    );
    expect(pluginGroup?.items.map((item) => item.path)).not.toContain(
      `${ADMIN_BASE_PATH}/platform-plugins`,
    );
    expect(getAdminSelectedKey('/settings/admin/platform-plugins')).toBe(ADMIN_BASE_PATH);
    expect(getAdminOpenKeys('/settings/admin/platform-plugins')).toEqual(['overview']);
    expect(getAdminSelectedKey('/settings/admin/module-apps')).toBe(
      `${ADMIN_BASE_PATH}/module-apps`,
    );
    expect(getAdminOpenKeys('/settings/admin/module-apps')).toEqual(['plugins']);
  });

  it('keeps storage and maintenance settings in the system module', () => {
    const systemItems = ADMIN_NAV_GROUPS.find((group) => group.key === 'system')?.items ?? [];

    expect(
      systemItems.find((item) => item.path === `${ADMIN_BASE_PATH}/file-storage`),
    ).toMatchObject({
      icon: 'file-storage',
    });
    expect(
      systemItems.find((item) => item.path === `${ADMIN_BASE_PATH}/maintenance`),
    ).toMatchObject({
      icon: 'maintenance',
    });
    expect(
      ADMIN_NAV_GROUPS.flatMap((group) => group.items).find(
        (item) => item.path === `${ADMIN_BASE_PATH}/notifications`,
      )?.description,
    ).not.toContain('閫氱煡淇濈暀鏃堕棿');
  });

  it('moves desktop client settings into the client module', () => {
    const clientItems = ADMIN_NAV_GROUPS.find((group) => group.key === 'client')?.items ?? [];
    const systemItems = ADMIN_NAV_GROUPS.find((group) => group.key === 'system')?.items ?? [];

    expect(clientItems).toContainEqual(
      expect.objectContaining({
        icon: 'desktop',
        label: '客户端',
        path: `${ADMIN_BASE_PATH}/desktop-update`,
      }),
    );
    expect(systemItems.map((item) => item.path)).not.toContain(
      `${ADMIN_BASE_PATH}/desktop-update`,
    );
    expect(getAdminOpenKeys('/settings/admin/desktop-update')).toEqual(['client']);
  });

  it('maps legacy billing routes to their merged sidebar entries', () => {
    expect(getAdminSelectedKey('/settings/admin/pricing')).toBe(
      `${ADMIN_BASE_PATH}/model-billing-matrix`,
    );
    expect(getAdminSelectedKey('/settings/admin/topup')).toBe(`${ADMIN_BASE_PATH}/orders`);
    expect(getAdminSelectedKey('/settings/admin/change-requests')).toBe(
      `${ADMIN_BASE_PATH}/subscriptions`,
    );
  });

  it('normalizes legacy root admin URLs before selecting the sidebar item', () => {
    expect(getAdminSelectedKey('/admin')).toBe(ADMIN_BASE_PATH);
    expect(getAdminSelectedKey('/admin/users')).toBe(`${ADMIN_BASE_PATH}/users`);
    expect(getAdminSelectedKey('/admin/pricing')).toBe(`${ADMIN_BASE_PATH}/model-billing-matrix`);
    expect(getAdminOpenKeys('/admin/pricing')).toEqual(['model-billing']);
  });

  it('selects the nearest admin item for nested URLs and opens its module', () => {
    expect(getAdminSelectedKey('/settings/admin')).toBe(ADMIN_BASE_PATH);
    expect(getAdminSelectedKey('/settings/admin/users/abc')).toBe(`${ADMIN_BASE_PATH}/users`);
    expect(getAdminSelectedKey('/settings/admin/providers/edit')).toBe(
      `${ADMIN_BASE_PATH}/providers`,
    );
    expect(getAdminSelectedKey('/settings/admin/model-billing-matrix')).toBe(
      `${ADMIN_BASE_PATH}/model-billing-matrix`,
    );
    expect(getAdminSelectedKey('/settings/admin/ppt')).toBe(`${ADMIN_BASE_PATH}/ppt`);
    expect(getAdminSelectedKey('/settings/admin/module-apps')).toBe(
      `${ADMIN_BASE_PATH}/module-apps`,
    );
    expect(getAdminSelectedKey('/settings/admin/notifications')).toBe(
      `${ADMIN_BASE_PATH}/notifications`,
    );
    expect(getAdminSelectedKey('/settings/admin/expert-plaza')).toBe(
      `${ADMIN_BASE_PATH}/expert-plaza`,
    );
    expect(getAdminSelectedKey('/settings/admin/topics')).toBe(`${ADMIN_BASE_PATH}/topics`);
    expect(getAdminSelectedKey('/settings/admin/files')).toBe(`${ADMIN_BASE_PATH}/files`);
    expect(getAdminSelectedKey('/settings/admin/file-storage')).toBe(
      `${ADMIN_BASE_PATH}/file-storage`,
    );
    expect(getAdminSelectedKey('/settings/admin/documents')).toBe(`${ADMIN_BASE_PATH}/documents`);
    expect(getAdminSelectedKey('/settings/admin/system-defaults')).toBe(
      `${ADMIN_BASE_PATH}/system-defaults`,
    );
    expect(getAdminSelectedKey('/settings/admin/maintenance')).toBe(
      `${ADMIN_BASE_PATH}/maintenance`,
    );
    expect(getAdminSelectedKey('/settings/admin/desktop-update')).toBe(
      `${ADMIN_BASE_PATH}/desktop-update`,
    );

    expect(getAdminOpenKeys('/settings/admin/providers/edit')).toEqual(['model-billing']);
    expect(getAdminOpenKeys('/settings/admin/model-billing-matrix')).toEqual(['model-billing']);
    expect(getAdminOpenKeys('/settings/admin/ppt')).toEqual(['model-billing']);
    expect(getAdminOpenKeys('/settings/admin/module-apps')).toEqual(['plugins']);
    expect(getAdminOpenKeys('/settings/admin/notifications')).toEqual(['brand-growth']);
    expect(getAdminOpenKeys('/settings/admin/expert-plaza')).toEqual(['brand-growth']);
    expect(getAdminOpenKeys('/settings/admin/topics')).toEqual(['content']);
    expect(getAdminOpenKeys('/settings/admin/files')).toEqual(['content']);
    expect(getAdminOpenKeys('/settings/admin/file-storage')).toEqual(['system']);
    expect(getAdminOpenKeys('/settings/admin/documents')).toEqual(['content']);
    expect(getAdminOpenKeys('/settings/admin/system-defaults')).toEqual(['system']);
    expect(getAdminOpenKeys('/settings/admin/maintenance')).toEqual(['system']);
    expect(getAdminOpenKeys('/settings/admin/desktop-update')).toEqual(['client']);
  });
});
