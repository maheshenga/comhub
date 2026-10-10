import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');

describe('scoped admin user actions', () => {
  it('gates full-admin and finance actions on the user list', () => {
    // B2 拆分：行内能力门（canSetRoles/canImpersonate/canManageFinance 的列内
    // 三元）迁 Users/ 域目录，契约面同 PR 成对拼接迁移。
    const source =
      readSource('src/routes/(main)/admin/users/index.tsx') +
      readSource('src/features/Admin/Users/userColumns.tsx') +
      readSource('src/features/Admin/Users/userBulkToolbar.tsx');

    expect(source).toContain('isFullAdminRole(role)');
    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite)');
    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.adminAccess)');
    expect(source).toContain("canManageFinance ? ['admin-user-list-plan-options'] : null");
    expect(source).toContain('canSetRoles ? (');
    expect(source).toContain('canImpersonate ? (');
    expect(source).toContain('canManageFinance ? (');
  });

  it('does not fetch plans or expose finance actions in the user detail drawer', () => {
    const source = readSource('src/features/Admin/AdminUserDetailDrawer.tsx');

    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite)');
    expect(source).toContain("canManageFinance ? ['admin-plan-catalog-options'] : null");
    expect(source).toContain('canManageFinance ? (');
  });

  it('uses compact user data outside the support detail boundary', () => {
    const source = readSource('src/features/Admin/AdminUserDetailDrawer.tsx');

    expect(source).toContain(
      'const canReadFullDetail = hasAdminCapability(role, ADMIN_CAPABILITIES.supportWrite);',
    );
    expect(source).toContain('adminCommercialService.getCompactUserDetail(userId!)');
    expect(source).toContain("['admin-user-compact-detail', userId]");
    expect(source).toContain('const data = fullDetail;');
    expect(source).toContain('data ? (');
    expect(source).toContain('compactDetail ? (');
  });
});

describe('scoped model billing matrix actions', () => {
  it('gates each read and write section on its owning capability', () => {
    const source = readSource('src/features/Admin/AdminModelBillingMatrixPage.tsx');
    const matrixData = readSource('src/features/Admin/ModelBillingMatrix/useMatrixData.ts');
    const matrixTable = readSource('src/features/Admin/ModelBillingMatrix/MatrixTable.tsx');

    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.modelOpsRead)');
    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead)');
    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.systemRead)');
    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite)');
    expect(source).toContain('hasAdminCapability(role, ADMIN_CAPABILITIES.systemWrite)');
    expect(matrixData).toContain('canReadModels ? MATRIX_KEY : null');
    expect(matrixData).toContain('canReadPlans ? PLANS_KEY : null');
    expect(matrixData).toContain(
      "canReadSettings ? ADMIN_SETTINGS_SECTION_SWR_KEY('model-billing-matrix') : null",
    );
    // The gated save controls live in the split MatrixTable section.
    expect(matrixTable).toContain('disabled={!canWriteFinance || !planData || saving}');
    expect(matrixTable).toContain('disabled={!canWriteSystem || !settings || saving}');
    expect(matrixTable).toContain(
      "!['pricingMultiplier', 'creditsPerDollar', 'actions'].includes(String(column.key))",
    );
    expect(matrixTable).toContain('columns={visibleColumns}');
  });
});
