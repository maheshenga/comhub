import { describe, expect, it } from 'vitest';

import { ADMIN_CAPABILITIES } from './admin';
import { ADMIN_COMMANDS, getAdminCommandDefinition } from './adminCommand';

const expectedCommands = {
  'content.deleteDocument': {
    auditAction: 'content.document.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.content.deleteDocument',
    reasonPolicy: 'none',
  },
  'content.deleteFile': {
    auditAction: 'content.file.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.content.deleteFile',
    reasonPolicy: 'none',
  },
  'content.deleteTopic': {
    auditAction: 'content.topic.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.content.deleteTopic',
    reasonPolicy: 'none',
  },
  'credits.adjust': {
    auditAction: 'credits.adjust',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    procedurePath: 'admin.credits.adjust',
    reasonPolicy: 'required',
  },
  'newapiProvider.deleteInstance': {
    auditAction: 'newapiInstance.delete',
    capability: ADMIN_CAPABILITIES.modelOpsWrite,
    confirmationMode: 'typed',
    procedurePath: 'admin.newapiProviders.deleteInstance',
    reasonPolicy: 'required',
  },
  'order.cancel': {
    auditAction: 'order.cancel',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.orders.cancel',
    reasonPolicy: 'none',
  },
  'order.expire': {
    auditAction: 'order.expire',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.orders.expire',
    reasonPolicy: 'none',
  },
  'order.settle': {
    auditAction: 'order.settle',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    procedurePath: 'admin.orders.settle',
    reasonPolicy: 'required',
  },
  'redemption.bulkDelete': {
    auditAction: 'redemption.bulkDelete',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    procedurePath: 'admin.redemption.bulkDelete',
    reasonPolicy: 'required',
  },
  'redemption.bulkDisable': {
    auditAction: 'redemption.bulkDisable',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.redemption.bulkDisable',
    reasonPolicy: 'none',
  },
  'setting.runMaintenance': {
    auditAction: 'maintenance.run',
    capability: ADMIN_CAPABILITIES.systemWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.settings.runMaintenance',
    reasonPolicy: 'none',
  },
  'setting.setAppSetting': {
    auditAction: 'settings.set',
    capability: ADMIN_CAPABILITIES.systemWrite,
    confirmationMode: 'none',
    procedurePath: 'admin.settings.setAppSetting',
    reasonPolicy: 'none',
  },
  'subscription.changeRequest.bulkApprove': {
    auditAction: 'subscription.changeRequest.bulkApprove',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.subscriptions.bulkApproveChangeRequests',
    reasonPolicy: 'none',
  },
  'subscription.changeRequest.bulkReject': {
    auditAction: 'subscription.changeRequest.bulkReject',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.subscriptions.bulkRejectChangeRequests',
    reasonPolicy: 'optional',
  },
  'user.impersonate.attempt': {
    auditAction: 'user.impersonate.attempt',
    capability: ADMIN_CAPABILITIES.supportWrite,
    confirmationMode: 'confirm',
    procedurePath: 'admin.users.recordImpersonationAttempt',
    reasonPolicy: 'none',
  },
  'user.resetAllToFreePlan': {
    auditAction: 'user.resetAllToFreePlan',
    capability: ADMIN_CAPABILITIES.adminAccess,
    confirmationMode: 'typed',
    procedurePath: 'admin.users.resetAllToFreePlan',
    reasonPolicy: 'required',
  },
  'user.setRole': {
    auditAction: 'user.setRole',
    capability: ADMIN_CAPABILITIES.adminAccess,
    confirmationMode: 'confirm',
    procedurePath: 'admin.users.setRole',
    reasonPolicy: 'none',
  },
} as const;

describe('ADMIN_COMMANDS', () => {
  it('defines the exact compatibility, audit, capability, and procedure contract', () => {
    expect(Object.keys(ADMIN_COMMANDS)).toEqual(Object.keys(expectedCommands));

    for (const [actionId, expected] of Object.entries(expectedCommands)) {
      expect(getAdminCommandDefinition(actionId), actionId).toMatchObject({
        actionId,
        ...expected,
        description: expect.any(String),
        severity: expect.stringMatching(/^(medium|high|critical)$/),
        title: expect.any(String),
      });
    }
  });

  it('keeps compatibility IDs and procedure paths unique', () => {
    const definitions = Object.values(ADMIN_COMMANDS);

    expect(new Set(definitions.map(({ actionId }) => actionId)).size).toBe(definitions.length);
    expect(new Set(definitions.map(({ procedurePath }) => procedurePath)).size).toBe(
      definitions.length,
    );
  });

  it('uses valid capabilities and coherent confirmation and reason policies', () => {
    const capabilities = new Set(Object.values(ADMIN_CAPABILITIES));

    for (const definition of Object.values(ADMIN_COMMANDS)) {
      expect(capabilities.has(definition.capability)).toBe(true);
      expect(definition.confirmationMode === 'none' && definition.reasonPolicy !== 'none').toBe(
        false,
      );
      expect(definition.confirmationMode === 'typed').toBe(definition.severity === 'critical');
    }
  });
});
