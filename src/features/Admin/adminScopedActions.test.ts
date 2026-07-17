import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');

describe('scoped admin user actions', () => {
  it('gates full-admin and finance actions on the user list', () => {
    const source = readSource('src/routes/(main)/admin/users/index.tsx');

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
});
