import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import subscription from '@/locales/default/subscription';

import { ADMIN_NAV_GROUPS } from './adminNavigation';

const repoRoot = path.resolve(__dirname, '../../..');

const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

const filesWithAdminCopy = [
  'src/features/Admin/adminNavigation.ts',
  'src/features/Admin/AdminDesktopUpdatePage.tsx',
  'src/features/Admin/AdminUserDetailDrawer.tsx',
  'src/routes/(main)/admin/subscriptions/index.tsx',
  'src/routes/(main)/admin/topup/index.tsx',
  'src/routes/(main)/admin/redemption/index.tsx',
  'src/routes/(main)/admin/users/index.tsx',
];

const corruptedFragments = [
  '????',
  '???',
  '鈥?',
  '鍏抽敭',
  '绠＄悊',
  '妗岄潰',
  '濂楅',
  '璁㈤',
  '鎿嶄綔',
  '鐢ㄦ埛',
];

describe('admin Chinese copy', () => {
  it('does not ship corrupted fallback text in admin pages', () => {
    for (const file of filesWithAdminCopy) {
      const content = readRepoFile(file);

      for (const fragment of corruptedFragments) {
        expect(content, `${file} contains ${fragment}`).not.toContain(fragment);
      }
    }
  });

  it('uses readable Chinese navigation labels for billing pages', () => {
    const businessItems = ADMIN_NAV_GROUPS.find((group) => group.key === 'business')?.items ?? [];

    expect(businessItems.find((item) => item.path.endsWith('/subscriptions'))).toMatchObject({
      label: '订阅管理',
    });
    expect(businessItems.find((item) => item.path.endsWith('/topup'))).toMatchObject({
      label: '充值套餐',
    });
    expect(businessItems.find((item) => item.path.endsWith('/redemption'))).toMatchObject({
      label: '兑换码',
    });
  });

  it('keeps default admin desktop update labels in Chinese', () => {
    expect(subscription['admin.sidebar.desktopUpdate']).toBe('桌面端更新');
    expect(subscription['admin.desktopUpdate.serverSection']).toBe('更新服务器');
    expect(subscription['admin.desktopUpdate.channel']).toBe('默认更新渠道');
    expect(subscription['admin.desktopUpdate.save']).toBe('保存');
  });

  it('includes default Chinese copy for assigning user plans from the user list', () => {
    const usersPage = readRepoFile('src/routes/(main)/admin/users/index.tsx');

    expect(subscription['admin.assignPlan']).toBe('设置套餐');
    expect(subscription['admin.assignPlan.title']).toBe('设置用户套餐');
    expect(subscription['admin.assignPlan.durationMonths']).toBe('使用时长（月）');
    expect(usersPage).toContain("t('admin.assignPlan', '设置套餐')");
    expect(usersPage).toContain('adminCommercialService.assignUserPlan');
  });
});
