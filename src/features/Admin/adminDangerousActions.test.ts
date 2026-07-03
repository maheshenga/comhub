import { describe, expect, it } from 'vitest';

import {
  ADMIN_DANGEROUS_ACTIONS,
  buildAdminDangerousActionConfirm,
  getAdminDangerousAction,
  requiresAdminActionReason,
  validateAdminDangerousActionConfirmation,
} from './adminDangerousActions';

const criticalActions = [
  'credits.adjust',
  'order.settle',
  'newapiProvider.deleteInstance',
  'redemption.bulkDelete',
  'subscription.changeRequest.bulkApprove',
  'subscription.changeRequest.bulkReject',
  'user.resetAllToFreePlan',
  'user.impersonate.attempt',
  'content.deleteTopic',
  'content.deleteFile',
  'content.deleteDocument',
  'setting.runMaintenance',
] as const;

describe('adminDangerousActions', () => {
  it('registers central metadata for P0 high-risk admin mutations', () => {
    for (const actionId of criticalActions) {
      expect(getAdminDangerousAction(actionId), actionId).toMatchObject({
        actionId,
        auditAction: expect.any(String),
        confirmation: expect.any(Object),
        severity: expect.stringMatching(/^(medium|high|critical)$/),
      });
    }
  });

  it('marks irreversible or financial mutations as requiring confirmation and a reason', () => {
    for (const actionId of [
      'credits.adjust',
      'order.settle',
      'newapiProvider.deleteInstance',
      'redemption.bulkDelete',
      'user.resetAllToFreePlan',
    ] as const) {
      const action = getAdminDangerousAction(actionId);

      expect(action?.requiresConfirmation).toBe(true);
      expect(requiresAdminActionReason(actionId)).toBe(true);
    }
  });

  it('keeps action identifiers unique and aligned with their registry keys', () => {
    const actions = Object.entries(ADMIN_DANGEROUS_ACTIONS);

    expect(new Set(actions.map(([key]) => key)).size).toBe(actions.length);
    for (const [key, action] of actions) {
      expect(action.actionId).toBe(key);
    }
  });

  it('builds typed confirmation requirements for critical admin actions', () => {
    expect(buildAdminDangerousActionConfirm('credits.adjust')).toMatchObject({
      actionId: 'credits.adjust',
      requiredConfirmationText: 'credits.adjust',
      requiresReason: true,
      requiresTypedConfirmation: true,
      severity: 'critical',
    });
  });

  it('validates confirmation text and reason for critical admin actions', () => {
    expect(
      validateAdminDangerousActionConfirmation('credits.adjust', {
        confirmed: true,
        confirmationText: 'wrong',
        reason: 'manual compensation',
      }),
    ).toEqual(
      expect.objectContaining({
        errors: ['confirmation_text_mismatch'],
        ok: false,
      }),
    );

    expect(
      validateAdminDangerousActionConfirmation('credits.adjust', {
        confirmed: true,
        confirmationText: 'credits.adjust',
        reason: 'manual compensation',
      }),
    ).toEqual(
      expect.objectContaining({
        errors: [],
        ok: true,
      }),
    );
  });

  it('requires a checkbox confirmation for high-risk actions without forcing typed text', () => {
    expect(buildAdminDangerousActionConfirm('user.setRole')).toMatchObject({
      actionId: 'user.setRole',
      requiredConfirmationText: undefined,
      requiresConfirmation: true,
      requiresReason: false,
      requiresTypedConfirmation: false,
      severity: 'high',
    });

    expect(validateAdminDangerousActionConfirmation('user.setRole', {})).toEqual(
      expect.objectContaining({
        errors: ['confirmation_required'],
        ok: false,
      }),
    );
  });

  it('registers bulk change request actions for the shared bulk state machine', () => {
    expect(buildAdminDangerousActionConfirm('subscription.changeRequest.bulkApprove')).toMatchObject({
      actionId: 'subscription.changeRequest.bulkApprove',
      requiresConfirmation: true,
      requiresReason: false,
      requiresTypedConfirmation: false,
      severity: 'high',
    });
    expect(buildAdminDangerousActionConfirm('subscription.changeRequest.bulkReject')).toMatchObject({
      actionId: 'subscription.changeRequest.bulkReject',
      requiresConfirmation: true,
      requiresReason: false,
      requiresTypedConfirmation: false,
      severity: 'high',
    });
  });
});
