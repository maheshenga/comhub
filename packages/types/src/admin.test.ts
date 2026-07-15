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

  it('publishes read/write capability pairs for every governed admin domain', () => {
    expect(ADMIN_CAPABILITIES).toMatchObject({
      contentRead: 'content.read',
      contentWrite: 'content.write',
      modelOpsRead: 'modelOps.read',
      modelOpsWrite: 'modelOps.write',
      moduleAppRead: 'moduleApp.read',
      moduleAppWrite: 'moduleApp.write',
      supportRead: 'support.read',
      supportWrite: 'support.write',
      systemRead: 'system.read',
      systemWrite: 'system.write',
      userRead: 'user.read',
      userWrite: 'user.write',
    });
  });

  it('grants scoped roles their read capability without cross-domain access', () => {
    expect(getAdminRoleCapabilities('content_admin')).toEqual(
      expect.arrayContaining([
        ADMIN_CAPABILITIES.auditRead,
        ADMIN_CAPABILITIES.contentRead,
        ADMIN_CAPABILITIES.contentWrite,
      ]),
    );
    expect(getAdminRoleCapabilities('model_ops')).toEqual(
      expect.arrayContaining([
        ADMIN_CAPABILITIES.auditRead,
        ADMIN_CAPABILITIES.modelOpsRead,
        ADMIN_CAPABILITIES.modelOpsWrite,
      ]),
    );
    expect(getAdminRoleCapabilities('support_admin')).toEqual(
      [
        ADMIN_CAPABILITIES.supportRead,
        ADMIN_CAPABILITIES.supportWrite,
        ADMIN_CAPABILITIES.userRead,
        ADMIN_CAPABILITIES.auditRead,
      ],
    );
    expect(getAdminRoleCapabilities('system_admin')).toEqual(
      expect.arrayContaining([
        ADMIN_CAPABILITIES.auditRead,
        ADMIN_CAPABILITIES.systemRead,
        ADMIN_CAPABILITIES.systemWrite,
      ]),
    );
    expect(hasAdminCapability('content_admin', ADMIN_CAPABILITIES.moduleAppWrite)).toBe(false);
    expect(hasAdminCapability('support_admin', ADMIN_CAPABILITIES.financeWrite)).toBe(false);
  });
});
