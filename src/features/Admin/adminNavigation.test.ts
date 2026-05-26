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
    expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toEqual([
      '工作台',
      '用户与套餐',
      '模型与计费',
      '品牌与增长',
      '内容治理',
      '系统运维',
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
        `${ADMIN_BASE_PATH}/subscriptions`,
        `${ADMIN_BASE_PATH}/redemption`,
        `${ADMIN_BASE_PATH}/settings`,
        `${ADMIN_BASE_PATH}/stats`,
        `${ADMIN_BASE_PATH}/topics`,
        `${ADMIN_BASE_PATH}/files`,
        `${ADMIN_BASE_PATH}/documents`,
        `${ADMIN_BASE_PATH}/system-defaults`,
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
      label: '模型与计费矩阵',
    });
    expect(
      modelApiItems.find((item) => item.path === `${ADMIN_BASE_PATH}/model-policy`),
    ).toMatchObject({
      label: '全局模型策略',
    });
  });

  it('describes the model center using current admin concepts', () => {
    const modelApiGroup = ADMIN_NAV_GROUPS.find((group) => group.key === 'model-billing');
    const providerItem = modelApiGroup?.items.find(
      (item) => item.path === `${ADMIN_BASE_PATH}/providers`,
    );

    expect(modelApiGroup?.description).toBe(
      '服务商实例、模型同步、默认模型、套餐权限、模型策略和计费矩阵',
    );
    expect(providerItem?.description).toBe('维护服务商实例、分组、用途范围和模型目录');
    expect(providerItem?.icon).toBe('providers');
    expect(ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.icon))).not.toContain(
      'newapi',
    );
    expect(providerItem?.description).not.toContain('NewAPI / OpenAI');
    expect(collectPaths()).not.toContain(`${ADMIN_BASE_PATH}/newapi-providers`);
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
    expect(getAdminSelectedKey('/settings/admin/notifications')).toBe(
      `${ADMIN_BASE_PATH}/notifications`,
    );
    expect(getAdminSelectedKey('/settings/admin/expert-plaza')).toBe(
      `${ADMIN_BASE_PATH}/expert-plaza`,
    );
    expect(getAdminSelectedKey('/settings/admin/topics')).toBe(`${ADMIN_BASE_PATH}/topics`);
    expect(getAdminSelectedKey('/settings/admin/files')).toBe(`${ADMIN_BASE_PATH}/files`);
    expect(getAdminSelectedKey('/settings/admin/documents')).toBe(`${ADMIN_BASE_PATH}/documents`);
    expect(getAdminSelectedKey('/settings/admin/system-defaults')).toBe(
      `${ADMIN_BASE_PATH}/system-defaults`,
    );

    expect(getAdminOpenKeys('/settings/admin/providers/edit')).toEqual(['model-billing']);
    expect(getAdminOpenKeys('/settings/admin/model-billing-matrix')).toEqual(['model-billing']);
    expect(getAdminOpenKeys('/settings/admin/ppt')).toEqual(['model-billing']);
    expect(getAdminOpenKeys('/settings/admin/notifications')).toEqual(['brand-growth']);
    expect(getAdminOpenKeys('/settings/admin/expert-plaza')).toEqual(['brand-growth']);
    expect(getAdminOpenKeys('/settings/admin/topics')).toEqual(['content']);
    expect(getAdminOpenKeys('/settings/admin/files')).toEqual(['content']);
    expect(getAdminOpenKeys('/settings/admin/documents')).toEqual(['content']);
    expect(getAdminOpenKeys('/settings/admin/system-defaults')).toEqual(['system']);
  });
});
