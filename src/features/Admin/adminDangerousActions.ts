export type AdminDangerousActionSeverity = 'medium' | 'high' | 'critical';

export type AdminDangerousActionConfirmation = {
  description: string;
  title: string;
};

export type AdminDangerousActionMetadata = {
  actionId: string;
  auditAction: string;
  confirmation: AdminDangerousActionConfirmation;
  requiresConfirmation: boolean;
  requiresReason: boolean;
  severity: AdminDangerousActionSeverity;
};

export const ADMIN_DANGEROUS_ACTIONS = {
  'content.deleteDocument': {
    actionId: 'content.deleteDocument',
    auditAction: 'content.deleteDocument',
    confirmation: {
      description: 'Deletes a user document and related knowledge content.',
      title: 'Delete document',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'content.deleteFile': {
    actionId: 'content.deleteFile',
    auditAction: 'content.deleteFile',
    confirmation: {
      description: 'Deletes a user resource file and can remove indexed content.',
      title: 'Delete file',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'content.deleteTopic': {
    actionId: 'content.deleteTopic',
    auditAction: 'content.deleteTopic',
    confirmation: {
      description: 'Deletes a user topic and its conversation context.',
      title: 'Delete topic',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'credits.adjust': {
    actionId: 'credits.adjust',
    auditAction: 'credits.adjust',
    confirmation: {
      description: 'Changes a user credit balance and writes ledger entries.',
      title: 'Adjust credits',
    },
    requiresConfirmation: true,
    requiresReason: true,
    severity: 'critical',
  },
  'newapiProvider.deleteInstance': {
    actionId: 'newapiProvider.deleteInstance',
    auditAction: 'newapiProvider.deleteInstance',
    confirmation: {
      description: 'Deletes an upstream provider instance and its synced model configuration.',
      title: 'Delete provider instance',
    },
    requiresConfirmation: true,
    requiresReason: true,
    severity: 'critical',
  },
  'order.cancel': {
    actionId: 'order.cancel',
    auditAction: 'order.cancel',
    confirmation: {
      description: 'Cancels a pending recharge order.',
      title: 'Cancel order',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'medium',
  },
  'order.expire': {
    actionId: 'order.expire',
    auditAction: 'order.expire',
    confirmation: {
      description: 'Expires a pending recharge order.',
      title: 'Expire order',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'medium',
  },
  'order.settle': {
    actionId: 'order.settle',
    auditAction: 'order.settle',
    confirmation: {
      description: 'Manually settles a recharge order and grants credits.',
      title: 'Settle order',
    },
    requiresConfirmation: true,
    requiresReason: true,
    severity: 'critical',
  },
  'redemption.bulkDelete': {
    actionId: 'redemption.bulkDelete',
    auditAction: 'redemption.bulkDelete',
    confirmation: {
      description: 'Permanently deletes multiple redemption codes.',
      title: 'Delete redemption codes',
    },
    requiresConfirmation: true,
    requiresReason: true,
    severity: 'critical',
  },
  'redemption.bulkDisable': {
    actionId: 'redemption.bulkDisable',
    auditAction: 'redemption.bulkDisable',
    confirmation: {
      description: 'Disables multiple redemption codes.',
      title: 'Disable redemption codes',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'subscription.changeRequest.bulkApprove': {
    actionId: 'subscription.changeRequest.bulkApprove',
    auditAction: 'subscription.changeRequest.bulkApprove',
    confirmation: {
      description: 'Approves multiple pending subscription change requests.',
      title: 'Approve subscription change requests',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'subscription.changeRequest.bulkReject': {
    actionId: 'subscription.changeRequest.bulkReject',
    auditAction: 'subscription.changeRequest.bulkReject',
    confirmation: {
      description: 'Rejects multiple pending subscription change requests.',
      title: 'Reject subscription change requests',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'setting.runMaintenance': {
    actionId: 'setting.runMaintenance',
    auditAction: 'settings.runMaintenance',
    confirmation: {
      description: 'Runs operational maintenance that can affect site-wide cached settings.',
      title: 'Run maintenance',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'setting.setAppSetting': {
    actionId: 'setting.setAppSetting',
    auditAction: 'settings.setAppSetting',
    confirmation: {
      description: 'Changes a site-wide runtime setting.',
      title: 'Update site setting',
    },
    requiresConfirmation: false,
    requiresReason: false,
    severity: 'medium',
  },
  'user.impersonate.attempt': {
    actionId: 'user.impersonate.attempt',
    auditAction: 'user.impersonate.attempt',
    confirmation: {
      description: 'Records an administrator attempt to impersonate a user.',
      title: 'Impersonate user',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
  'user.resetAllToFreePlan': {
    actionId: 'user.resetAllToFreePlan',
    auditAction: 'user.resetAllToFreePlan',
    confirmation: {
      description: 'Resets every user subscription to the free plan.',
      title: 'Reset all users to free plan',
    },
    requiresConfirmation: true,
    requiresReason: true,
    severity: 'critical',
  },
  'user.setRole': {
    actionId: 'user.setRole',
    auditAction: 'user.setRole',
    confirmation: {
      description: 'Changes a user account role.',
      title: 'Change user role',
    },
    requiresConfirmation: true,
    requiresReason: false,
    severity: 'high',
  },
} as const satisfies Record<string, AdminDangerousActionMetadata>;

export type AdminDangerousActionId = keyof typeof ADMIN_DANGEROUS_ACTIONS;

export type AdminDangerousActionConfirm = AdminDangerousActionMetadata & {
  requiredConfirmationText?: string;
  requiresTypedConfirmation: boolean;
};

export type AdminDangerousActionConfirmationError =
  | 'confirmation_required'
  | 'confirmation_text_mismatch'
  | 'reason_required'
  | 'unknown_action';

export type AdminDangerousActionConfirmationInput = {
  confirmationText?: string;
  confirmed?: boolean;
  reason?: null | string;
};

export type AdminDangerousActionConfirmationResult = {
  errors: AdminDangerousActionConfirmationError[];
  ok: boolean;
  requirement?: AdminDangerousActionConfirm;
};

export const getAdminDangerousAction = (actionId: string) =>
  ADMIN_DANGEROUS_ACTIONS[actionId as AdminDangerousActionId];

export const requiresAdminActionReason = (actionId: string) =>
  getAdminDangerousAction(actionId)?.requiresReason ?? false;

export const buildAdminDangerousActionConfirm = (
  actionId: string,
): AdminDangerousActionConfirm | undefined => {
  const action = getAdminDangerousAction(actionId);
  if (!action) return;

  const requiresTypedConfirmation = action.requiresConfirmation && action.severity === 'critical';

  return {
    ...action,
    requiredConfirmationText: requiresTypedConfirmation ? action.actionId : undefined,
    requiresTypedConfirmation,
  };
};

export const validateAdminDangerousActionConfirmation = (
  actionId: string,
  input: AdminDangerousActionConfirmationInput = {},
): AdminDangerousActionConfirmationResult => {
  const requirement = buildAdminDangerousActionConfirm(actionId);
  if (!requirement) return { errors: ['unknown_action'], ok: false };

  const errors: AdminDangerousActionConfirmationError[] = [];

  if (requirement.requiresConfirmation && !input.confirmed) {
    errors.push('confirmation_required');
  }

  if (
    requirement.requiresTypedConfirmation &&
    input.confirmationText?.trim() !== requirement.requiredConfirmationText
  ) {
    errors.push('confirmation_text_mismatch');
  }

  if (requirement.requiresReason && !input.reason?.trim()) {
    errors.push('reason_required');
  }

  return {
    errors,
    ok: errors.length === 0,
    requirement,
  };
};
