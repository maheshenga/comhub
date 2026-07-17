import { ADMIN_CAPABILITIES, type AdminCapability } from './admin';

export type AdminCommandSeverity = 'medium' | 'high' | 'critical';
export type AdminCommandConfirmationMode = 'none' | 'confirm' | 'typed';
export type AdminCommandReasonPolicy = 'none' | 'optional' | 'required';
export type AdminCommandServerBoundary =
  | { kind: 'http'; method: 'POST'; path: string }
  | { kind: 'trpc'; procedurePath: string };

export type AdminCommandDefinition = {
  actionId: string;
  auditAction: string;
  capability: AdminCapability;
  confirmationMode: AdminCommandConfirmationMode;
  description: string;
  reasonPolicy: AdminCommandReasonPolicy;
  serverBoundary: AdminCommandServerBoundary;
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
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.content.deleteDocument' },
    severity: 'high',
    title: 'Delete document',
  },
  'content.deleteFile': {
    actionId: 'content.deleteFile',
    auditAction: 'content.file.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    description: 'Deletes a user resource file and can remove indexed content.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.content.deleteFile' },
    severity: 'high',
    title: 'Delete file',
  },
  'content.deleteTopic': {
    actionId: 'content.deleteTopic',
    auditAction: 'content.topic.delete',
    capability: ADMIN_CAPABILITIES.contentWrite,
    confirmationMode: 'confirm',
    description: 'Deletes a user topic and its conversation context.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.content.deleteTopic' },
    severity: 'high',
    title: 'Delete topic',
  },
  'credits.adjust': {
    actionId: 'credits.adjust',
    auditAction: 'credits.adjust',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    description: 'Changes a user credit balance and writes ledger entries.',
    reasonPolicy: 'required',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.credits.adjust' },
    severity: 'critical',
    title: 'Adjust credits',
  },
  'newapiProvider.deleteInstance': {
    actionId: 'newapiProvider.deleteInstance',
    auditAction: 'newapiInstance.delete',
    capability: ADMIN_CAPABILITIES.modelOpsWrite,
    confirmationMode: 'typed',
    description: 'Deletes an upstream provider instance and its synced model configuration.',
    reasonPolicy: 'required',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.newapiProviders.deleteInstance' },
    severity: 'critical',
    title: 'Delete provider instance',
  },
  'order.cancel': {
    actionId: 'order.cancel',
    auditAction: 'order.cancel',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Cancels a pending recharge order.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.orders.cancel' },
    severity: 'medium',
    title: 'Cancel order',
  },
  'order.expire': {
    actionId: 'order.expire',
    auditAction: 'order.expire',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Expires a pending recharge order.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.orders.expire' },
    severity: 'medium',
    title: 'Expire order',
  },
  'order.settle': {
    actionId: 'order.settle',
    auditAction: 'order.settle',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    description: 'Manually settles a recharge order and grants credits.',
    reasonPolicy: 'required',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.orders.settle' },
    severity: 'critical',
    title: 'Settle order',
  },
  'redemption.bulkDelete': {
    actionId: 'redemption.bulkDelete',
    auditAction: 'redemption.bulkDelete',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'typed',
    description: 'Permanently deletes multiple redemption codes.',
    reasonPolicy: 'required',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.redemption.bulkDelete' },
    severity: 'critical',
    title: 'Delete redemption codes',
  },
  'redemption.bulkDisable': {
    actionId: 'redemption.bulkDisable',
    auditAction: 'redemption.bulkDisable',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Disables multiple redemption codes.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.redemption.bulkDisable' },
    severity: 'high',
    title: 'Disable redemption codes',
  },
  'setting.runMaintenance': {
    actionId: 'setting.runMaintenance',
    auditAction: 'maintenance.run',
    capability: ADMIN_CAPABILITIES.systemWrite,
    confirmationMode: 'confirm',
    description: 'Runs operational maintenance that can affect site-wide cached settings.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.settings.runMaintenance' },
    severity: 'high',
    title: 'Run maintenance',
  },
  'setting.setAppSetting': {
    actionId: 'setting.setAppSetting',
    auditAction: 'settings.set',
    capability: ADMIN_CAPABILITIES.systemWrite,
    confirmationMode: 'none',
    description: 'Changes a site-wide runtime setting.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.settings.setAppSetting' },
    severity: 'medium',
    title: 'Update site setting',
  },
  'subscription.changeRequest.bulkApprove': {
    actionId: 'subscription.changeRequest.bulkApprove',
    auditAction: 'subscription.changeRequest.bulkApprove',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Approves multiple pending subscription change requests.',
    reasonPolicy: 'none',
    serverBoundary: {
      kind: 'trpc',
      procedurePath: 'admin.subscriptions.bulkApproveChangeRequests',
    },
    severity: 'high',
    title: 'Approve subscription change requests',
  },
  'subscription.changeRequest.bulkReject': {
    actionId: 'subscription.changeRequest.bulkReject',
    auditAction: 'subscription.changeRequest.bulkReject',
    capability: ADMIN_CAPABILITIES.financeWrite,
    confirmationMode: 'confirm',
    description: 'Rejects multiple pending subscription change requests.',
    reasonPolicy: 'optional',
    serverBoundary: {
      kind: 'trpc',
      procedurePath: 'admin.subscriptions.bulkRejectChangeRequests',
    },
    severity: 'high',
    title: 'Reject subscription change requests',
  },
  'user.impersonate.attempt': {
    actionId: 'user.impersonate.attempt',
    auditAction: 'user.impersonate.attempt',
    capability: ADMIN_CAPABILITIES.supportWrite,
    confirmationMode: 'confirm',
    description: 'Records an administrator attempt to impersonate a user.',
    reasonPolicy: 'none',
    serverBoundary: {
      kind: 'http',
      method: 'POST',
      path: '/api/auth/admin/impersonate-user',
    },
    severity: 'high',
    title: 'Impersonate user',
  },
  'user.resetAllToFreePlan': {
    actionId: 'user.resetAllToFreePlan',
    auditAction: 'user.resetAllToFreePlan',
    capability: ADMIN_CAPABILITIES.adminAccess,
    confirmationMode: 'typed',
    description: 'Resets every user subscription to the free plan.',
    reasonPolicy: 'required',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.users.resetAllToFreePlan' },
    severity: 'critical',
    title: 'Reset all users to free plan',
  },
  'user.setRole': {
    actionId: 'user.setRole',
    auditAction: 'user.setRole',
    capability: ADMIN_CAPABILITIES.adminAccess,
    confirmationMode: 'confirm',
    description: 'Changes a user account role.',
    reasonPolicy: 'none',
    serverBoundary: { kind: 'trpc', procedurePath: 'admin.users.setRole' },
    severity: 'high',
    title: 'Change user role',
  },
} as const satisfies Record<string, AdminCommandDefinition>;

export type AdminCommandId = keyof typeof ADMIN_COMMANDS;

export const getAdminCommandDefinition = (actionId: string) =>
  ADMIN_COMMANDS[actionId as AdminCommandId];
