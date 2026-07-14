import { describe, expect, it } from 'vitest';

import {
  ADMIN_CAPABILITIES,
  ADMIN_ROLE_IDS,
  getAdminRoleCapabilities,
  hasAdminCapability,
  isAdminRole,
  isFullAdminRole,
} from './admin';

describe('shared admin roles', () => {
  it('publishes every assignable full and scoped admin role', () => {
    expect(ADMIN_ROLE_IDS).toEqual([
      'admin',
      'content_admin',
      'finance_admin',
      'model_ops',
      'support_admin',
      'system_admin',
    ]);

    for (const role of ADMIN_ROLE_IDS) expect(isAdminRole(role)).toBe(true);
    expect(isAdminRole('user')).toBe(false);
  });

  it('keeps scoped roles limited to their declared capabilities', () => {
    expect(isFullAdminRole('admin')).toBe(true);
    expect(isFullAdminRole('finance_admin')).toBe(false);
    expect(getAdminRoleCapabilities('finance_admin')).toEqual(
      expect.arrayContaining([
        ADMIN_CAPABILITIES.auditRead,
        ADMIN_CAPABILITIES.financeRead,
        ADMIN_CAPABILITIES.financeWrite,
      ]),
    );
    expect(hasAdminCapability('finance_admin', ADMIN_CAPABILITIES.systemWrite)).toBe(false);
    expect(hasAdminCapability('finance_admin', ADMIN_CAPABILITIES.adminAccess)).toBe(false);
  });
});
