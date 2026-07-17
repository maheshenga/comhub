import { ADMIN_CAPABILITIES, type AdminCapability } from './admin';

export type AdminCommandSeverity = 'medium' | 'high' | 'critical';
export type AdminCommandConfirmationMode = 'none' | 'confirm' | 'typed';
export type AdminCommandReasonPolicy = 'none' | 'optional' | 'required';

export type AdminCommandDefinition = {
  actionId: string;
  auditAction: string;
  capability: AdminCapability;
  confirmationMode: AdminCommandConfirmationMode;
  description: string;
  procedurePath: string;
  reasonPolicy: AdminCommandReasonPolicy;
  severity: AdminCommandSeverity;
  title: string;
};

export type AdminCommandEnvelope<TActionId extends string = string> = {
  actionId: TActionId;
  confirmationText?: string;
  confirmed?: boolean;
  reason?: null | string;
};

export const ADMIN_COMMANDS = {
  'content.deleteDocument': {
    actionId: 'content.deleteDocument',
    auditAction: 'content.document.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    description: 'Deletes a user document and related knowledge content.',
    procedurePath: 'admin.content.deleteDocument',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Delete document',
  },
  'content.deleteFile': {
    actionId: 'content.deleteFile',
    auditAction: 'content.file.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    description: 'Deletes a user resource file and can remove indexed content.',
    procedurePath: 'admin.content.deleteFile',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Delete file',
  },
  'content.deleteTopic': {
    actionId: 'content.deleteTopic',
    auditAction: 'content.topic.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    description: 'Deletes a user topic and its conversation context.',
    procedurePath: 'admin.content.deleteTopic',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Delete topic',
  },
  'credits.adjust': {
    actionId: 'credits.adjust',
    auditAction: 'credits.adjust',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    description: 'Changes a user credit balance and writes ledger entries.',
    procedurePath: 'admin.credits.adjust',
    reasonPolicy: 'required',
    severity: 'critical',
    title: 'Adjust credits',
  },
  'newapiProvider.deleteInstance': {
    actionId: 'newapiProvider.deleteInstance',
    auditAction: 'newapiInstance.delete',
    capability: ADMIN_CAPABILITIES.modelOpsWrite,
    confirmationMode: 'typed',
    description: 'Deletes an upstream provider instance and its synced model configuration.',
    procedurePath: 'admin.newapiProviders.deleteInstance',
    reasonPolicy: 'required',
    severity: 'critical',
    title: 'Delete provider instance',
  },
  'order.cancel': {
    actionId: 'order.cancel',
    auditAction: 'order.cancel',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Cancels a pending recharge order.',
    procedurePath: 'admin.orders.cancel',
    reasonPolicy: 'none',
    severity: 'medium',
    title: 'Cancel order',
  },
  'order.expire': {
    actionId: 'order.expire',
    auditAction: 'order.expire',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Expires a pending recharge order.',
    procedurePath: 'admin.orders.expire',
    reasonPolicy: 'none',
    severity: 'medium',
    title: 'Expire order',
  },
  'order.settle': {
    actionId: 'order.settle',
    auditAction: 'order.settle',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    description: 'Manually settles a recharge order and grants credits.',
    procedurePath: 'admin.orders.settle',
    reasonPolicy: 'required',
    severity: 'critical',
    title: 'Settle order',
  },
  'redemption.bulkDelete': {
    actionId: 'redemption.bulkDelete',
    auditAction: 'redemption.bulkDelete',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    description: 'Permanently deletes multiple redemption codes.',
    procedurePath: 'admin.redemption.bulkDelete',
    reasonPolicy: 'required',
    severity: 'critical',
    title: 'Delete redemption codes',
  },
  'redemption.bulkDisable': {
    actionId: 'redemption.bulkDisable',
    auditAction: 'redemption.bulkDisable',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Disables multiple redemption codes.',
    procedurePath: 'admin.redemption.bulkDisable',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Disable redemption codes',
  },
  'setting.runMaintenance': {
    actionId: 'setting.runMaintenance',
    auditAction: 'maintenance.run',
    capability: ADMIN_CAPABILITIES.systemWrite,
    confirmationMode: 'confirm',
    description: 'Runs operational maintenance that can affect site-wide cached settings.',
    procedurePath: 'admin.settings.runMaintenance',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Run maintenance',
  },
  'setting.setAppSetting': {
    actionId: 'setting.setAppSetting',
    auditAction: 'settings.set',
    capability: ADMIN_CAPABILITIES.systemWrite,
    confirmationMode: 'none',
    description: 'Changes a site-wide runtime setting.',
    procedurePath: 'admin.settings.setAppSetting',
    reasonPolicy: 'none',
    severity: 'medium',
    title: 'Update site setting',
  },
  'subscription.changeRequest.bulkApprove': {
    actionId: 'subscription.changeRequest.bulkApprove',
    auditAction: 'subscription.changeRequest.bulkApprove',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Approves multiple pending subscription change requests.',
    procedurePath: 'admin.subscriptions.bulkApproveChangeRequests',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Approve subscription change requests',
  },
  'subscription.changeRequest.bulkReject': {
    actionId: 'subscription.changeRequest.bulkReject',
    auditAction: 'subscription.changeRequest.bulkReject',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Rejects multiple pending subscription change requests.',
    procedurePath: 'admin.subscriptions.bulkRejectChangeRequests',
    reasonPolicy: 'optional',
    severity: 'high',
    title: 'Reject subscription change requests',
  },
  'user.impersonate.attempt': {
    actionId: 'user.impersonate.attempt',
    auditAction: 'user.impersonate.attempt',
    capability: ADMIN_CAPABILITIES.supportWrite,
    confirmationMode: 'confirm',
    description: 'Records an administrator attempt to impersonate a user.',
    procedurePath: 'admin.users.recordImpersonationAttempt',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Impersonate user',
  },
  'user.resetAllToFreePlan': {
    actionId: 'user.resetAllToFreePlan',
    auditAction: 'user.resetAllToFreePlan',
    capability: ADMIN_CAPABILITIES.adminAccess,
    confirmationMode: 'typed',
    description: 'Resets every user subscription to the free plan.',
    procedurePath: 'admin.users.resetAllToFreePlan',
    reasonPolicy: 'required',
    severity: 'critical',
    title: 'Reset all users to free plan',
  },
  'user.setRole': {
    actionId: 'user.setRole',
    auditAction: 'user.setRole',
    capability: ADMIN_CAPABILITIES.adminAccess,
    confirmationMode: 'confirm',
    description: 'Changes a user account role.',
    procedurePath: 'admin.users.setRole',
    reasonPolicy: 'none',
    severity: 'high',
    title: 'Change user role',
  },
} as const satisfies Record<string, AdminCommandDefinition>;

export type AdminCommandId = keyof typeof ADMIN_COMMANDS;

export const getAdminCommandDefinition = (actionId: string) =>
  ADMIN_COMMANDS[actionId as AdminCommandId];
