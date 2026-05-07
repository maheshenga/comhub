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
  it('organizes admin pages into the planned six management modules', () => {
    expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toEqual([
      '概览',
      '用户',
      '商业化',
      '模型与 API',
      '运营',
      '系统',
    ]);
  });

  it('keeps all existing admin routes reachable without duplicate sidebar paths', () => {
    const paths = collectPaths();

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining([
        ADMIN_BASE_PATH,
        `${ADMIN_BASE_PATH}/users`,
        `${ADMIN_BASE_PATH}/plans`,
        `${ADMIN_BASE_PATH}/topup`,
        `${ADMIN_BASE_PATH}/orders`,
        `${ADMIN_BASE_PATH}/credits`,
        `${ADMIN_BASE_PATH}/pricing`,
        `${ADMIN_BASE_PATH}/recommendations`,
        `${ADMIN_BASE_PATH}/operations`,
        `${ADMIN_BASE_PATH}/growth`,
        `${ADMIN_BASE_PATH}/model-policy`,
        `${ADMIN_BASE_PATH}/newapi-providers`,
        `${ADMIN_BASE_PATH}/model-billing-matrix`,
        `${ADMIN_BASE_PATH}/subscriptions`,
        `${ADMIN_BASE_PATH}/change-requests`,
        `${ADMIN_BASE_PATH}/redemption`,
        `${ADMIN_BASE_PATH}/settings`,
        `${ADMIN_BASE_PATH}/stats`,
        `${ADMIN_BASE_PATH}/audit`,
        `${ADMIN_BASE_PATH}/desktop-update`,
      ]),
    );
  });

  it('selects the nearest admin item for nested URLs and opens its module', () => {
    expect(getAdminSelectedKey('/settings/admin')).toBe(ADMIN_BASE_PATH);
    expect(getAdminSelectedKey('/settings/admin/users/abc')).toBe(`${ADMIN_BASE_PATH}/users`);
    expect(getAdminSelectedKey('/settings/admin/newapi-providers/edit')).toBe(
      `${ADMIN_BASE_PATH}/newapi-providers`,
    );
    expect(getAdminSelectedKey('/settings/admin/model-billing-matrix')).toBe(
      `${ADMIN_BASE_PATH}/model-billing-matrix`,
    );

    expect(getAdminOpenKeys('/settings/admin/newapi-providers/edit')).toEqual(['model-api']);
    expect(getAdminOpenKeys('/settings/admin/model-billing-matrix')).toEqual(['model-api']);
  });
});
